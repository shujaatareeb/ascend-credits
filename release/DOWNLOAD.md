# Source-Only Download Instructions (No Binary Files)

This repository now ships a **source-only** release folder because some platforms do not support binary artifacts.

## Release folder
Use this folder directly:

`release/ascend-credits-bot/`

It already contains everything needed to run the bot:
- `src/`
- `migrations/`
- `data/shop.json`
- `package.json`
- `README.md`
- `.env.example`

## How to run
```bash
cd release/ascend-credits-bot
cp .env.example .env
# edit .env with your real values
npm install
npm start
```

## Optional: create your own archive locally
If you still want a zip/tar for sharing, create it locally:

```bash
cd release
zip -r ascend-credits-bot.zip ascend-credits-bot
# or
tar -czf ascend-credits-bot.tar.gz ascend-credits-bot
```
