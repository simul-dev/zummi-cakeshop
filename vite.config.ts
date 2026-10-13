import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // host: true → 같은 Wi-Fi의 휴대폰에서 LAN 주소로 바로 접속해 테스트
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
