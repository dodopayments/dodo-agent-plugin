#!/bin/bash
# Builds one starter project per task and arm under runs/<task>-<arm>/.
set -euo pipefail
cd "$(dirname "$0")"
# Needs deps/next and deps/express: run `npm install` once in each, using the starter package.json below.
PLUGIN="$(cd ../../plugins/dodopayments && pwd)"
rm -rf runs && mkdir -p runs

starter() { # $1 dir, $2 kind
  local d=$1
  mkdir -p "$d"
  if [ "$2" = next ]; then
    cat > "$d/package.json" <<'EOF'
{ "name": "shop", "private": true, "type": "module",
  "scripts": { "build": "next build", "typecheck": "tsc --noEmit" },
  "dependencies": { "next": "16.4.5", "react": "19.2.0", "react-dom": "19.2.0", "dodopayments": "2.61.1", "standardwebhooks": "1.1.1" },
  "devDependencies": { "typescript": "5.9.3", "@types/node": "22.10.0", "@types/react": "19.2.0" } }
EOF
    cat > "$d/tsconfig.json" <<'EOF'
{ "compilerOptions": { "target": "ES2022", "lib": ["dom", "es2022"], "module": "esnext", "moduleResolution": "bundler", "jsx": "preserve", "strict": true, "noEmit": true, "skipLibCheck": true, "esModuleInterop": true, "plugins": [{ "name": "next" }], "allowJs": false, "incremental": true, "isolatedModules": true, "resolveJsonModule": true },
  "include": ["**/*.ts", "**/*.tsx"], "exclude": ["node_modules"] }
EOF
    mkdir -p "$d/app" && printf 'export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html><body>{children}</body></html>;\n}\n' > "$d/app/layout.tsx"
    printf 'export default function Home() {\n  return <main>Shop</main>;\n}\n' > "$d/app/page.tsx"
    printf '// DB stub: replace with your database.\nexport async function grantAccess(userId: string, productId: string): Promise<void> {}\nexport async function revokeAccess(userId: string): Promise<void> {}\n' > "$d/lib-db.ts"
  else
    cat > "$d/package.json" <<'EOF'
{ "name": "api", "private": true, "type": "module",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "express": "5.3.0", "dodopayments": "2.61.1", "standardwebhooks": "1.1.1" },
  "devDependencies": { "typescript": "5.9.3", "@types/node": "22.10.0", "@types/express": "5.0.6" } }
EOF
    cat > "$d/tsconfig.json" <<'EOF'
{ "compilerOptions": { "target": "ES2022", "module": "nodenext", "moduleResolution": "nodenext", "strict": true, "noEmit": true, "skipLibCheck": true, "esModuleInterop": true }, "include": ["src/**/*.ts"] }
EOF
    mkdir -p "$d/src"
    printf "import express from 'express';\n\nconst app = express();\napp.use(express.json());\n\napp.listen(3000);\n" > "$d/src/server.ts"
    printf '// DB stub: replace with your database.\nexport async function setPlan(userId: string, status: string, subscriptionId: string): Promise<void> {}\n' > "$d/src/db.ts"
  fi
}

for task in t1 t2 t3; do
  kind=express; [ $task = t1 ] && kind=next
  for arm in none plugin; do
    d=runs/$task-$arm
    starter $d $kind
    if [ $arm = plugin ]; then
      mkdir -p $d/.opencode/skills
      cp -R $PLUGIN/skills/* $d/.opencode/skills/
      cat > $d/opencode.json <<'EOF'
{ "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "dodopayments-api": { "type": "remote", "url": "https://mcp.dodopayments.com/mcp", "enabled": true },
    "dodo-knowledge": { "type": "remote", "url": "https://knowledge.dodopayments.com/mcp", "enabled": true } } }
EOF
    fi
    cp -c -R deps/$kind/node_modules deps/$kind/package-lock.json $d/
    printf 'node_modules/\n' > $d/.gitignore
    (cd $d && git init -q && git add -A && git -c user.email=b@b -c user.name=bench commit -qm starter)
  done
done
ls runs
