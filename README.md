# Hatchan-bot

Discord用の「冷笑警察bot」です。監視対象チャンネルで特定の文字列を含むメッセージを検知すると、メンション無しで返信します。

## 機能

- `/start`, `/stop` で、コマンドを実行したチャンネルの監視を開始・停止できます
- デフォルトで「うお」「おお」「どわ」のいずれかを含むメッセージに反応します
- `/trigger add` で反応する文字列と、その文字列専用の返信内容を後から追加・更新できます（返信内容を省略した場合は標準の冷笑警察メッセージが使われます）
- `/trigger remove` / `/trigger list` で登録済みの文字列の削除・一覧表示ができます
- 設定（監視中チャンネル・トリガー一覧）は `data/store.json` に保存され、再起動しても保持されます

デフォルトの返信内容:

```
🚨冷笑を検知しました🚨
👮冷笑警察👮です。
時代は__**～熱笑～**__。
笑いに温度を。笑いに魂を。
もっと熱く笑いましょう。
ガハハwWwwWwwww
ガハハハハハハハハwwwwww
```

## セットアップ

### 1. Discord Developer Portal でアプリケーションを作成

1. https://discord.com/developers/applications で新規アプリケーションを作成
2. 「Bot」タブでBotを作成し、**Token** を控える
3. 「Bot」タブの **Privileged Gateway Intents** で **MESSAGE CONTENT INTENT** を有効化する（メッセージ内容の取得に必須）
4. 「OAuth2 > URL Generator」で以下を選択し、生成されたURLからサーバーに招待する
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `View Channels`, `Send Messages`, `Read Message History`

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、値を埋めます。

```
cp .env.example .env
```

- `DISCORD_TOKEN`: Botのトークン
- `DISCORD_CLIENT_ID`: アプリケーションID（General Information ページに記載）
- `DISCORD_GUILD_ID`: （任意）開発用サーバーのID。指定するとスラッシュコマンドが即時反映されます。未指定の場合はグローバル登録となり反映まで時間がかかることがあります。

### 3. 依存関係のインストール

```
npm install
```

### 4. スラッシュコマンドの登録

```
npm run deploy-commands
```

### 5. Bot起動

```
npm start
```

## 使い方

1. 監視したいチャンネルで `/start` を実行（監視開始）
2. 「うお」「おお」「どわ」のいずれかを含むメッセージが投稿されると、bot が該当メッセージにメンション無しで返信します
3. 監視をやめたい場合は同じチャンネルで `/stop` を実行

### トリガーの追加・管理

```
/trigger add word:わお reply:任意の返信メッセージ
/trigger add word:へへ            # replyを省略すると標準メッセージが使われます
/trigger remove word:わお
/trigger list
```

`/start`, `/stop`, `/trigger` はいずれもサーバー管理権限（Manage Server）を持つメンバーのみ実行できます。
