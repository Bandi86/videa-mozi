## Project init

pnpm init

## Folder structure

│── apps/
│ ├── frontend/ # Next.js app
│ └── backend/ # Express + Prisma app
│── package.json
│── pnpm-workspace.yaml
│── tsconfig.json
│── .eslintrc.json
│── .prettierrc
│── .husky/

echo "packages:\n - 'apps/\*'" > pnpm-workspace.yaml

## Dependency management

pnpm add -D typescript ts-node @types/node eslint prettier husky lint-staged
pnpm add -D concurrently
pnpm add -D prettier prettier-plugin-tailwindcss

## TypeScript alap config (tsconfig.json)

{
"compilerOptions": {
"target": "ES2022",
"module": "ESNext",
"moduleResolution": "Node",
"resolveJsonModule": true,
"esModuleInterop": true,
"forceConsistentCasingInFileNames": true,
"strict": true,
"skipLibCheck": true,
"outDir": "dist"
},
"include": ["app/*/src"],
"exclude": ["node_modules", "dist"]
}

## ESLint alap config (.eslintrc.json)

{
"root": true,
"parser": "@typescript-eslint/parser",
"plugins": ["@typescript-eslint", "prettier", "unused-imports", "import"],
"extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
"rules": {
"prettier/prettier": "error",
"unused-imports/no-unused-imports": "warn",
"import/order": ["warn", { "alphabetize": { "order": "asc", "caseInsensitive": true }, "newlines-between": "always" }]
},
"ignorePatterns": ["dist", "node_modules"]
}

## Prettier alap config (.prettierrc)

{
"semi": false,
"singleQuote": true,
"trailingComma": "all",
"printWidth": 100,
"tabWidth": 2,
"endOfLine": "lf",
"bracketSpacing": true,
"arrowParens": "avoid",
"plugins": ["prettier-plugin-tailwindcss"]
}

## Husky + lint-staged setup

pnpm dlx husky-init && pnpm install

.husky/pre-commit

# !/bin/sh

. "$(dirname "$0")/\_/husky.sh"

pnpm lint-staged

## Root setup package json (root)

{
"lint-staged": {
"\_.{js,ts,tsx,json,md,css,scss}": [
"prettier --write",
"eslint --fix"
]
},
"scripts": {
"dev": "concurrently --kill-others-on-fail -n frontend,backend -c cyan,green \"pnpm -C app/frontend dev\" \"pnpm -C app/backend dev\""
"build": "pnpm -C app/frontend build && pnpm -C app/backend build",
"prepare": "husky",
"lint": "eslint . --ext .ts,.tsx",
"format": "prettier --write ."
},
}

## Editor Config setup

root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

## Backend setup (Express + Prisma)

cd apps && mkdir backend && cd backend
pnpm init

pnpm add express cors morgan helmet dotenv
pnpm add class-validator class-transformer zod
pnpm add bcrypt jsonwebtoken
pnpm add -D typescript ts-node-dev @types/node @types/express prisma
pnpm add -D @types/morgan @types/cors
npx prisma init

Alap szerver (apps/backend/src/index.ts):

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(express.json())
app.use(cors())
app.use(helmet())
app.use(morgan('dev'))

app.get('/', (req, res) => {
res.send('Hello from backend!')
})

app.listen(PORT, () => {
console.log(`🚀 Backend running on http://localhost:${PORT}`)
})

## Package json backend (apps/backend)

linux legacy watch
{
"scripts": {
"dev": "nodemon --legacy-watch --watch src --ext ts,tsx --exec ts-node src/index.ts",
"build": "tsc",
"start": "node dist/index.js",
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev"
}
}

## Frontend setup (Nextjs shadcn)

pnpm create next-app@latest --typescript --eslint
pnpm dlx shadcn@latest init
pnpm add axios
pnpm dlx shadcn@latest add button

## morgan cors typscript hiba javitasa

app/backend/src/types/custom.d.ts
declare module 'morgan'
declare module 'cors'
