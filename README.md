# G2 Running

Even Realities G2용 러닝 플러그인(Even Hub)입니다. 휴대폰 GPS로 시간, 거리, 현재/평균 페이스를 안경에 띄웁니다.

## 조작 (안경 터치패드 또는 R1 링)
- 탭: 시작 / 일시정지 / 재개
- 더블탭: 러닝 중이면 종료하고 기록 저장, 대기 중이면 앱 종료

## 실행
```bash
npm install
npm test           # 거리/페이스 계산 테스트
npm run dev        # http://<PC IP>:5173
npx evenhub qr --url http://<PC IP>:5173   # Even 앱(개발자 모드)에서 QR 스캔
npm run pack       # running.ehpk 생성
```
`npm run sim`(시뮬레이터)은 GPS를 지원하지 않아서 시간만 올라갑니다.

## 삼성헬스 / 갤럭시 워치
지금은 러닝 기록을 워치의 삼성헬스 운동 기록으로 남기는 방식입니다(이 앱과 동시에 시작).
안경에 심박을 띄우려면 워치 앱 → 폰 앱 → 플러그인으로 데이터를 넘기는 단계가 추가로 필요합니다.
