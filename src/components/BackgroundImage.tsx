export function BackgroundImage() {
  return (
    <div className='fixed inset-0 pointer-events-none z-0'>
      {/* 🖼️ Статичная подложка - создает глубину и богатство */}
      <div
        className='w-full h-full opacity-80'
        style={{
          backgroundImage: 'url(/Startrail.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* 🌀 Вращающийся слой - создает медитативный эффект */}
      <div
        className='absolute inset-0 w-full h-full opacity-85 animate-slow-spin'
        style={{
          backgroundImage: 'url(/Startrail.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  )
}
