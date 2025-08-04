# 🗃️ UPDATED: File Management Plan (август 2025)

## 🎯 Цель: Двухэтапная загрузка и сохранение уникальных исходников

---

## 🔑 Основные принципы

1. **Сохраняем оригинальные файлы** навсегда (`.pdf`, `.docx`, `.txt`, `.epub` и др.)
2. **Дедупликация по SHA-256** оригинала (`file_hash`)
3. **Папки по дате или по хешу** — чтобы избежать перезаписи одинаковых имён
4. **После загрузки** — статус `original_uploaded`
5. **Парсинг в `.txt` + второй хеш (`txt_hash`)** для смысловой дедупликации
6. **Если `txt_hash` уже есть** — не делаем эмбеддинг
7. **Синхронизация вручную** через кнопку "Эмбеддить новые"
8. **Оба файла (`original` и `.txt`) хранятся** в `uploads/original` и `uploads/txt`

---

## 📁 Структура файлов

```
/uploads/
├── original/
│   └── 2025-08-04/
│       ├── agni-yoga.pdf
│       └── agni-yoga.docx
├── txt/
│   └── a1/
│       ├── a1b2c3d4e5.txt
│       └── a1b2c3d4e5.meta.json
```

---

## 🧠 Расширение базы данных

```sql
ALTER TABLE processed_files ADD COLUMN txt_hash TEXT;
ALTER TABLE processed_files ADD COLUMN status TEXT DEFAULT 'original_uploaded';
ALTER TABLE processed_files ADD COLUMN storage_path TEXT;
ALTER TABLE processed_files ADD COLUMN txt_path TEXT;
ALTER TABLE processed_files ADD COLUMN meta_path TEXT;
ALTER TABLE processed_files ADD COLUMN embedded_at DATETIME;

CREATE UNIQUE INDEX idx_txt_hash ON processed_files(txt_hash);
```

---

## 🔄 Процесс загрузки

```
📁 Upload file
   ↓
🔐 file_hash → поиск дубля оригинала
   ↓
📝 Если уникален → записываем в /original + БД
   ↓
🟡 Статус: original_uploaded
   ↓
🔘 Кнопка: "Синхронизация с векторной БД"
   ↓
🔄 Парсинг в .txt → txt_hash
   ↓
❓ Есть ли такой txt_hash в БД?
   ↓
✅ Да → не эмбеддим, просто связываем
❌ Нет → эмбеддим и сохраняем .txt + .meta
   ↓
🟢 Статус: embedded
```

---

## 📊 Статистика

- Всего загружено: **512 файлов**
- Уникальных `txt`: **384**
- Ожидают эмбеддинг: **128**
