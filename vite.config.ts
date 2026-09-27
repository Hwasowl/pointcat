import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// 출시 빌드에 테스트 ID가 섞여 나가지 않게 막는다
const RELEASE_KEYS = ['VITE_PROMOTION_CODE', 'VITE_REWARDED_AD_GROUP_ID', 'VITE_INTERSTITIAL_AD_GROUP_ID', 'VITE_BANNER_AD_GROUP_ID', 'VITE_TEXT_BANNER_AD_GROUP_ID']
const isTestValue = (v: string) => !v || v.startsWith('TEST_') || v.startsWith('ait-ad-test')

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const bad = RELEASE_KEYS.filter((k) => isTestValue(env[k] ?? ''))
    if (bad.length) {
      throw new Error(`출시 빌드에 운영 값이 없어요: ${bad.join(', ')} — .env.production을 채우거나, 테스트 빌드는 npm run build:test`)
    }
  }
  return {
    plugins: [aitDevtools.vite(), react()],
  }
})
