# 🎯 CURSOR AI: Реализация двухэтапной системы загрузки файлов

## 📋 ЗАДАЧА
Реализовать новую архитектуру загрузки файлов с разделением на два этапа:
1. **Загрузка оригиналов** → создание библиотеки уникальных источников
2. **Синхронизация** → обработка в txt + эмбеддинг (по кнопке)

## 🎯 ЦЕЛЬ
Заменить текущую систему (загрузка → сразу эмбеддинг) на контролируемую двухэтапную с сохранением всех оригинальных файлов навсегда.

---

## 📚 ДОКУМЕНТАЦИЯ
**Используй обновленные планы:**
- `UPDATED-file-management-plan.md` — детальная архитектура файловой системы
- `UPDATED-MASTER-PLAN.md` — общая концепция и этапы развития

---

## 🗄️ ИЗМЕНЕНИЯ В БАЗЕ ДАННЫХ

```sql
-- Добавить новые поля в processed_files
ALTER TABLE processed_files ADD COLUMN txt_hash TEXT;
ALTER TABLE processed_files ADD COLUMN status TEXT DEFAULT 'original_uploaded';
ALTER TABLE processed_files ADD COLUMN storage_path TEXT;
ALTER TABLE processed_files ADD COLUMN txt_path TEXT;
ALTER TABLE processed_files ADD COLUMN meta_path TEXT;
ALTER TABLE processed_files ADD COLUMN embedded_at DATETIME;

-- Уникальные индексы для дедупликации
CREATE UNIQUE INDEX idx_file_hash ON processed_files(file_hash);
CREATE UNIQUE INDEX idx_txt_hash ON processed_files(txt_hash) WHERE txt_hash IS NOT NULL;
```

**Статусы файлов:**
- `original_uploaded` — оригинал загружен, ждет обработки
- `embedded` — обработан и в векторной БД
- `duplicate_content` — содержимое дублирует другой файл

---

## 📁 ФАЙЛОВАЯ СТРУКТУРА

```
/uploads/
├── original/                    # Оригинальные файлы (навсегда)
│   └── YYYY-MM-DD/             # Папки по дате загрузки
│       ├── filename1.pdf
│       └── filename2.docx
├── txt/                         # Обработанные txt файлы
│   └── [hash_prefix]/          # Папки по первым символам hash
│       ├── [txt_hash].txt
│       └── [txt_hash].meta.json
```

---

## 🔄 ЛОГИКА РАБОТЫ

### **ЭТАП 1: Загрузка файла**
```typescript
async function uploadFile(file: File) {
  // 1. Вычислить file_hash (SHA-256)
  const fileHash = await calculateSHA256(file);
  
  // 2. Проверить, есть ли уже такой file_hash
  const existing = await db.findByFileHash(fileHash);
  if (existing) {
    return { error: 'Файл уже загружен', existing };
  }
  
  // 3. Сохранить в /uploads/original/YYYY-MM-DD/
  const datePath = format(new Date(), 'yyyy-MM-dd');
  const storagePath = `/uploads/original/${datePath}/${file.name}`;
  await saveFile(file, storagePath);
  
  // 4. Записать в БД со статусом 'original_uploaded'
  await db.create({
    filename: file.name,
    file_hash: fileHash,
    status: 'original_uploaded',
    storage_path: storagePath,
    file_size: file.size,
    original_format: getFileExtension(file.name),
    upload_date: new Date()
  });
  
  return { success: true, status: 'original_uploaded' };
}
```

### **ЭТАП 2: Синхронизация (по кнопке)**
```typescript
async function syncWithVectorDB() {
  // 1. Найти все файлы со статусом 'original_uploaded'
  const pendingFiles = await db.findByStatus('original_uploaded');
  
  for (const file of pendingFiles) {
    // 2. Парсить файл в txt
    const txtContent = await parseFileToText(file.storage_path);
    
    // 3. Вычислить txt_hash
    const txtHash = await calculateSHA256(txtContent);
    
    // 4. Проверить дубликат по содержанию
    const duplicate = await db.findByTxtHash(txtHash);
    if (duplicate) {
      await db.update(file.id, { 
        status: 'duplicate_content',
        txt_hash: txtHash 
      });
      continue;
    }
    
    // 5. Сохранить txt + метаданные
    const txtPath = `/uploads/txt/${txtHash.slice(0, 2)}/${txtHash}.txt`;
    const metaPath = `/uploads/txt/${txtHash.slice(0, 2)}/${txtHash}.meta.json`;
    
    await saveTextFile(txtContent, txtPath);
    await saveMetaFile({
      file_hash: file.file_hash,
      txt_hash: txtHash,
      original_filename: file.filename,
      processing_date: new Date()
    }, metaPath);
    
    // 6. Создать эмбеддинг и сохранить в Qdrant
    await createEmbedding(txtContent, txtHash);
    
    // 7. Обновить статус
    await db.update(file.id, {
      status: 'embedded',
      txt_hash: txtHash,
      txt_path: txtPath,
      meta_path: metaPath,
      embedded_at: new Date()
    });
  }
}
```

---

## 🖥️ UI ИЗМЕНЕНИЯ

### **1. Главная страница админки**
Добавить статистический блок:
```tsx
<div className="stats-panel">
  <div className="stat">
    <h3>📚 Загружено файлов</h3>
    <span className="number">{totalFiles}</span>
  </div>
  <div className="stat">
    <h3>🧠 В векторной БД</h3>
    <span className="number">{embeddedFiles}</span>
  </div>
  <div className="stat">
    <h3>⏳ Ожидают синхронизации</h3>
    <span className="number">{pendingFiles}</span>
  </div>
  
  {pendingFiles > 0 && (
    <button onClick={syncWithVectorDB} className="sync-button">
      🔄 Синхронизировать с векторной БД
    </button>
  )}
</div>
```

### **2. Страница файлов**
Обновить таблицу с новыми колонками:
- Статус (original_uploaded, embedded, duplicate_content)
- Дата загрузки
- Ссылки на оригинал и txt файл

---

## 🧪 API ENDPOINTS

### **POST /api/upload**
- Загрузка файла в библиотеку оригиналов
- Проверка file_hash на дубликаты
- Возврат статистики

### **POST /api/sync**
- Синхронизация с векторной БД
- Обработка pending файлов
- Возврат прогресса обработки

### **GET /api/stats**
- Общая статистика библиотеки
- Количество файлов по статусам
- Размер хранилища

---

## ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После реализации:

1. **📁 Файлы загружаются** в `/uploads/original/` и остаются там навсегда
2. **📊 UI показывает статистику:** сколько загружено, сколько обработано
3. **🔘 Кнопка синхронизации** появляется только при наличии новых файлов
4. **🔍 Дедупликация работает** на двух уровнях (файл + содержимое)
5. **💾 База данных содержит** полную информацию о статусах и путях
6. **⚡ Эмбеддинг происходит** только для уникального контента

---

## 🚨 ВАЖНЫЕ МОМЕНТЫ

- **НЕ УДАЛЯТЬ** оригинальные файлы после обработки
- **ОБЯЗАТЕЛЬНО** проверять file_hash перед загрузкой
- **ОБЯЗАТЕЛЬНО** проверять txt_hash перед эмбеддингом
- **СОХРАНЯТЬ** все метаданные в .meta.json файлах
- **ПОКАЗЫВАТЬ** прогресс обработки в UI

---

## 🔧 ИСПОЛЬЗУЕМЫЕ БИБЛИОТЕКИ

- **crypto** — для вычисления SHA-256
- **fs/promises** — для работы с файлами
- **path** — для работы с путями
- **date-fns** — для форматирования дат

---

**Вопросы? Нужны уточнения по реализации?**
