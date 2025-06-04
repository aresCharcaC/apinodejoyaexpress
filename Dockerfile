# Dockerfile
FROM node:22

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos del proyecto
COPY package*.json ./
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Puerto expuesto por Express
EXPOSE 3000

# Comando de arranque
CMD ["npm", "run", "dev"]
