# Imagen base ligera de Node.js
FROM node:22.20.0-alpine3.22

# Directorio de trabajo dentro del contenedor
WORKDIR /src

# Copiar package.json y package-lock.json primero (para aprovechar cache de dependencias)
COPY package*.json ./

# Instalar dependencias en modo producción
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Variables de entorno (Railway las inyecta automáticamente desde su panel)
ENV NODE_ENV=production
ENV PORT=5000

# Exponer el puerto
EXPOSE 5000

# Comando de inicio
CMD ["npm", "start"]
