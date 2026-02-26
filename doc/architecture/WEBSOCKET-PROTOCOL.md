# WebSocket 消息协议

## 窗口 → 服务器

### 注册消息
```json
{
  "type": "register",
  "folders": [
    { "name": "frontend", "path": "D:/Project/frontend" },
    { "name": "backend", "path": "D:/Project/backend" }
  ]
}
```

### 任务结果
```json
{
  "type": "result",
  "requestId": "uuid-xxx",
  "data": { ... }
}
```

### 任务错误
```json
{
  "type": "error",
  "requestId": "uuid-xxx",
  "error": { "code": "NOT_FOUND", "message": "Symbol not found" }
}
```

## 服务器 → 窗口

### 注册确认
```json
{
  "type": "registered",
  "windowId": "win-abc123"
}
```

### 任务下发
```json
{
  "type": "task",
  "requestId": "uuid-xxx",
  "tool": "goToDefinition",
  "args": {
    "projectPath": "D:/Project/frontend",
    "filePath": "src/index.ts",
    "line": 10,
    "character": 5
  }
}
```
