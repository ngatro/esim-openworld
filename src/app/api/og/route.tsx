import { ImageResponse } from 'next/og';

export const runtime = 'edge'; // Sử dụng Edge Runtime để tốc độ phản hồi nhanh nhất

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Lấy country và lang từ query params
  const country = searchParams.get('country') || 'Global';
  const lang = searchParams.get('lang') || 'en';

  // Định nghĩa nội dung theo ngôn ngữ
  const content: Record<string, { brand: string; subtitle: string }> = {
    en: {
      brand: "OpenWorld eSIM",
      subtitle: "Instant 4G/5G Connectivity",
    },
    vi: {
      brand: "OpenWorld eSIM",
      subtitle: "Kết nối 4G/5G tức thì",
    },
    de: {
      brand: "OpenWorld eSIM",
      subtitle: "Sofortige 4G/5G Verbindung",
    },
    fr: {
      brand: "OpenWorld eSIM",
      subtitle: "Connexion 4G/5G Instantanée",
    },
  };

  const selected = content[lang] || content['en'];

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          backgroundImage: 'radial-gradient(circle at center, #1e3a8a 0%, #000000 100%)', // Hiệu ứng chiều sâu
          fontFamily: 'sans-serif',
        }}
      >
        
        <div style={{ position: 'absolute', top: 40, left: 40, right: 40, bottom: 40, border: '2px solid rgba(255,255,255,0.1)', borderRadius: 20 }}></div>

        <div style={{ fontSize: 50, color: '#3b82f6', fontWeight: 'bold', marginBottom: 10 }}>
          {selected.brand}
        </div>
        
        <div style={{ 
          fontSize: 120, 
          color: 'white', 
          fontWeight: '900', 
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '-0.05em'
        }}>
          {country}
        </div>

        <div style={{ 
          fontSize: 35, 
          color: '#94a3b8', 
          marginTop: 30,
          padding: '10px 30px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 50
        }}>
          {selected.subtitle}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}