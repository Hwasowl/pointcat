import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'pointcat',
  brand: {
    primaryColor: '#3B3F7C',
  },
  permissions: [],
  // 풍경이 화면 맨 위까지 이어지도록 네비게이션 바 배경을 투명하게 둔다.
  navigationBar: {
    transparentBackground: true,
    theme: 'dark',
  },
  webView: {
    bounces: false,
    overScrollMode: 'never',
  },
  webBundleDir: 'dist',
});
