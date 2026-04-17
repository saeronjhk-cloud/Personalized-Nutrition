import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.co.nutriformula.app',
  appName: '서박사의 영양공식',
  webDir: 'dist',
  server: {
    // 프로덕션에서는 번들된 웹 앱 사용
    // 개발 중에는 아래 주석을 풀고 PC IP로 변경
    // url: 'http://192.168.x.x:3000',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2D5A27',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      backgroundColor: '#2D5A27',
      style: 'LIGHT',
    },
  },
}

export default config
