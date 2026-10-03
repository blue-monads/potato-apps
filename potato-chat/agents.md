# Potato Chat - Project Documentation

## Overview
A chat application built on Potatoverse (Lua backend) and React (TypeScript frontend). Poatoverse is a single binary platform for running apps it comes with lua vm and sqlite and ability to serve files. It has own bindings to interfacing with the system and capbilities so read potatoverse docs for more details https://github.com/blue-monads/potatoverse/tree/main/docs. or ../potatoverse/docs folder 

## Tech Stack
- **Backend**: Spacetime with Lua (`server/server.lua`)
- **Frontend**: React + TypeScript + Vite (pre compiled / static, simple react-router no SSR bullshit  )
- **Database**: SQLite 

## Project Structure

```
potato-chat/
├── server/
│   ├── server.lua       # Main API handlers
│   ├── migration/       # Database migrations (SQL)
├── ui/
│   └── src/
│       ├── Chat/       # React components
│       │   ├── ChatView.tsx
│       │   ├── Sidebar.tsx
│       │   ├── MessageList.tsx
│       │   ├── MessageInput.tsx
│       │   ├── CreateChannelModal.tsx
│       │   └── StartDirectChatModal.tsx
│       ├── Home/
│       ├── lib/
│       │   └── api.ts  # API client
│       └── router.tsx
├── potato.yaml        # App configuration
└── readme.md
```

# Coding styles

- define props type as `PropsType` and never destructure props, i like where variables comes from as `props.something` make clear.
 