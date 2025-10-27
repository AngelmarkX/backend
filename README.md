# Backend - Sistema de Donación de Alimentos

API REST para la gestión de donaciones de alimentos, construida con Node.js y Express.

## Descripción

Backend del sistema de donación de alimentos que permite a donantes publicar alimentos disponibles y a organizaciones benéficas reservarlos. Incluye autenticación JWT, gestión de usuarios, donaciones, reservas y estadísticas.

## Tecnologías

- **Node.js** v14+
- **Express.js** - Framework web
- **SQLite/MySQL** - Base de datos
- **JWT** - Autenticación
- **Nodemailer** - Envío de emails
- **bcrypt** - Encriptación de contraseñas

## Requisitos Previos

- Node.js v14 o superior
- npm o yarn
- SQLite (incluido) o MySQL (opcional para producción)

## Instalación

1. Navega a la carpeta del backend:
\`\`\`bash
cd backend
\`\`\`

2. Instala las dependencias:
\`\`\`bash
npm install
\`\`\`

3. Crea el archivo `.env` basado en `.env.example`:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Configura las variables de entorno en `.env`:
\`\`\`env
PORT=3000
JWT_SECRET=tu_clave_secreta_muy_segura_aqui
DATABASE_URL=./database.sqlite

# Email Configuration (opcional)
GMAIL_USER=tu_email@gmail.com
GMAIL_APP_PASSWORD=tu_app_password
\`\`\`

## Configuración de Base de Datos

### SQLite (Desarrollo)
La base de datos SQLite se crea automáticamente al iniciar el servidor.

### MySQL (Producción)
1. Crea una base de datos MySQL
2. Actualiza `DATABASE_URL` en `.env`:
\`\`\`env
DATABASE_URL=mysql://usuario:password@host:puerto/nombre_db
\`\`\`

## Ejecutar el Servidor

### Modo Desarrollo
\`\`\`bash
npm start
\`\`\`

El servidor se ejecutará en `http://localhost:3000`

### Modo Producción
\`\`\`bash
NODE_ENV=production npm start
\`\`\`

## Estructura del Proyecto

\`\`\`
backend/
├── server.js           # Punto de entrada principal
├── database.sqlite     # Base de datos SQLite (generada)
├── .env               # Variables de entorno (no incluido en git)
├── .env.example       # Plantilla de variables de entorno
├── package.json       # Dependencias y scripts
└── README.md          # Esta documentación
\`\`\`

## API Endpoints

### Autenticación

#### POST /api/auth/register
Registra un nuevo usuario.

**Body:**
\`\`\`json
{
  "email": "usuario@example.com",
  "password": "password123",
  "name": "Nombre Usuario",
  "userType": "donor",
  "phone": "+573001234567",
  "address": "Calle 123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "email": "usuario@example.com",
    "name": "Nombre Usuario",
    "userType": "donor"
  }
}
\`\`\`

#### POST /api/auth/login
Inicia sesión.

**Body:**
\`\`\`json
{
  "email": "usuario@example.com",
  "password": "password123"
}
\`\`\`

#### POST /api/auth/forgot-password
Solicita código de recuperación de contraseña.

#### POST /api/auth/reset-password
Restablece la contraseña con el código.

#### POST /api/auth/change-password
Cambia la contraseña del usuario autenticado.

### Usuarios

#### GET /api/users/profile
Obtiene el perfil del usuario autenticado.

**Headers:**
\`\`\`
Authorization: Bearer {token}
\`\`\`

#### PUT /api/users/profile
Actualiza el perfil del usuario.

#### GET /api/users/stats
Obtiene estadísticas del usuario.

### Donaciones

#### POST /api/donations
Crea una nueva donación.

**Body:**
\`\`\`json
{
  "title": "Pan del día",
  "description": "Pan fresco sobrante",
  "category": "panaderia",
  "quantity": "10 unidades",
  "expiryDate": "2025-10-22",
  "pickupLocation": "Calle 123",
  "latitude": 4.6097,
  "longitude": -74.0817
}
\`\`\`

#### GET /api/donations
Lista todas las donaciones disponibles.

**Query params:**
- `status` - Filtrar por estado (available, reserved, completed)
- `category` - Filtrar por categoría

#### GET /api/donations/:id
Obtiene detalles de una donación específica.

#### PUT /api/donations/:id
Actualiza una donación (solo el creador).

#### DELETE /api/donations/:id
Elimina una donación (solo el creador).

#### GET /api/donations/my-donations
Lista las donaciones del usuario autenticado.

#### GET /api/donations/received
Lista las donaciones recibidas (organizaciones).

### Reservas

#### POST /api/donations/:id/reserve
Reserva una donación.

#### POST /api/donations/:id/complete
Marca una donación como completada.

#### POST /api/donations/:id/cancel
Cancela una reserva.

### Días de Donación (Organizaciones)

#### GET /api/donation-days
Obtiene los días de donación de una organización.

#### PUT /api/donation-days
Actualiza los días de donación.

**Body:**
\`\`\`json
{
  "donation_days": "1,3,5"
}
\`\`\`

## Variables de Entorno

| Variable | Descripción | Requerido | Default |
|----------|-------------|-----------|---------|
| `PORT` | Puerto del servidor | No | 3000 |
| `JWT_SECRET` | Clave secreta para JWT | Sí | - |
| `DATABASE_URL` | URL de la base de datos | No | ./database.sqlite |
| `GMAIL_USER` | Email para envío de correos | No | - |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación Gmail | No | - |

## Autenticación

El sistema usa JWT (JSON Web Tokens) para autenticación:

1. El usuario se registra o inicia sesión
2. El servidor devuelve un token JWT
3. El cliente incluye el token en el header `Authorization: Bearer {token}`
4. El servidor valida el token en cada petición protegida

## Categorías de Alimentos

- `frutas_verduras` - Frutas y Verduras
- `lacteos` - Lácteos
- `carnes` - Carnes y Pescados
- `panaderia` - Panadería
- `enlatados` - Enlatados
- `granos` - Granos y Cereales
- `bebidas` - Bebidas
- `snacks` - Snacks
- `congelados` - Congelados
- `preparados` - Comidas Preparadas
- `otros` - Otros

## Códigos de Estado HTTP

- `200` - Éxito
- `201` - Creado exitosamente
- `400` - Error en la petición
- `401` - No autenticado
- `403` - No autorizado
- `404` - No encontrado
- `500` - Error del servidor

## Seguridad

- Contraseñas encriptadas con bcrypt (10 rounds)
- Tokens JWT con expiración de 7 días
- Validación de entrada en todos los endpoints
- Headers de seguridad configurados
- CORS habilitado para dominios específicos

## Despliegue

### Railway

1. Crea una cuenta en [Railway](https://railway.app)
2. Conecta tu repositorio
3. Configura las variables de entorno
4. Railway desplegará automáticamente

### Render

1. Crea una cuenta en [Render](https://render.com)
2. Crea un nuevo Web Service
3. Conecta tu repositorio
4. Configura las variables de entorno
5. Deploy

## Troubleshooting

### Error: "JWT_SECRET no está configurado"
Asegúrate de tener `JWT_SECRET` en tu archivo `.env`

### Error: "SQLITE_CANTOPEN"
Verifica que tienes permisos de escritura en la carpeta del proyecto

### Error: "Port already in use"
Cambia el puerto en `.env` o detén el proceso que está usando el puerto 3000

### Emails no se envían
Verifica que `GMAIL_USER` y `GMAIL_APP_PASSWORD` estén correctamente configurados

## Logs

El servidor incluye logs detallados:
- `🚀` - Inicio del servidor
- `📊` - Estadísticas
- `✅` - Operación exitosa
- `❌` - Error
- `🔍` - Búsqueda/Query
- `📝` - Actualización

## Testing

Para probar los endpoints, puedes usar:

**cURL:**
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
\`\`\`

**Postman:**
Importa la colección de endpoints desde la documentación API

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto no tiene licencia definida actualmente. Todos los derechos reservados.

## Soporte

Para reportar bugs o solicitar features, abre un issue en el repositorio.

## Documentación Adicional

- [API Documentation](../API_DOCUMENTATION.md) - Documentación completa de la API
- [Technical Documentation](../TECHNICAL_DOCUMENTATION.md) - Documentación técnica del sistema
- [Project Map](../PROJECT_MAP.md) - Mapa del proyecto

## Arquitectura del Sistema

### Modelo de Datos

#### Tabla: users
Almacena información de usuarios (donantes y organizaciones).

**Campos:**
- `id` (INTEGER PRIMARY KEY) - Identificador único
- `email` (TEXT UNIQUE) - Email del usuario
- `password` (TEXT) - Contraseña encriptada con bcrypt
- `name` (TEXT) - Nombre completo
- `userType` (TEXT) - Tipo: 'donor' o 'organization'
- `phone` (TEXT) - Teléfono con código de país
- `address` (TEXT) - Dirección física
- `donation_days` (TEXT) - Días de recolección (solo organizaciones)
- `created_at` (DATETIME) - Fecha de registro

#### Tabla: donations
Almacena las donaciones publicadas.

**Campos:**
- `id` (INTEGER PRIMARY KEY) - Identificador único
- `donor_id` (INTEGER) - ID del donante (FK a users)
- `title` (TEXT) - Título de la donación
- `description` (TEXT) - Descripción detallada
- `category` (TEXT) - Categoría del alimento
- `quantity` (TEXT) - Cantidad disponible
- `expiryDate` (DATE) - Fecha de expiración
- `pickupLocation` (TEXT) - Dirección de recolección
- `latitude` (REAL) - Coordenada latitud
- `longitude` (REAL) - Coordenada longitud
- `status` (TEXT) - Estado: 'available', 'reserved', 'completed', 'cancelled'
- `reserved_by` (INTEGER) - ID de quien reservó (FK a users)
- `reserved_at` (DATETIME) - Fecha de reserva
- `completed_at` (DATETIME) - Fecha de completado
- `created_at` (DATETIME) - Fecha de creación

#### Tabla: password_resets
Almacena códigos de recuperación de contraseña.

**Campos:**
- `id` (INTEGER PRIMARY KEY) - Identificador único
- `user_id` (INTEGER) - ID del usuario (FK a users)
- `code` (TEXT) - Código de 6 dígitos
- `expires_at` (DATETIME) - Fecha de expiración (15 minutos)
- `used` (INTEGER) - Si fue usado (0 o 1)
- `created_at` (DATETIME) - Fecha de creación

### Flujos de Negocio

#### Flujo de Registro
1. Usuario envía datos de registro
2. Backend valida email único
3. Encripta contraseña con bcrypt
4. Crea usuario en base de datos
5. Genera token JWT
6. Retorna token y datos de usuario

#### Flujo de Donación
1. Donante crea donación con ubicación
2. Sistema valida datos y permisos
3. Guarda donación con estado 'available'
4. Donación aparece en mapa para organizaciones
5. Organización reserva donación
6. Estado cambia a 'reserved'
7. Donante completa la entrega
8. Estado cambia a 'completed'
9. Estadísticas se actualizan

#### Flujo de Recuperación de Contraseña
1. Usuario solicita recuperación
2. Sistema genera código de 6 dígitos
3. Envía código por email
4. Usuario ingresa código
5. Sistema valida código y expiración
6. Usuario establece nueva contraseña
7. Código se marca como usado

### Seguridad Implementada

#### Autenticación JWT
- Token generado con `jsonwebtoken`
- Expiración de 7 días
- Incluye: `userId`, `email`, `userType`
- Verificación en middleware `authenticateToken`

#### Encriptación de Contraseñas
- bcrypt con 10 salt rounds
- Nunca se almacenan contraseñas en texto plano
- Comparación segura con `bcrypt.compare()`

#### Validaciones
- Email único en registro
- Formato de email válido
- Longitud mínima de contraseña
- Validación de tipos de usuario
- Verificación de permisos por endpoint

#### CORS
- Configurado para permitir orígenes específicos
- Headers permitidos: Authorization, Content-Type
- Métodos permitidos: GET, POST, PUT, DELETE

### Endpoints por Funcionalidad

#### Gestión de Usuarios
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/users/profile` - Ver perfil
- `PUT /api/users/profile` - Actualizar perfil
- `GET /api/users/stats` - Estadísticas

#### Gestión de Donaciones
- `POST /api/donations` - Crear donación
- `GET /api/donations` - Listar donaciones
- `GET /api/donations/:id` - Ver donación
- `PUT /api/donations/:id` - Actualizar donación
- `DELETE /api/donations/:id` - Eliminar donación
- `GET /api/donations/my-donations` - Mis donaciones
- `GET /api/donations/received` - Donaciones recibidas

#### Gestión de Reservas
- `POST /api/donations/:id/reserve` - Reservar
- `POST /api/donations/:id/complete` - Completar
- `POST /api/donations/:id/cancel` - Cancelar

#### Recuperación de Contraseña
- `POST /api/auth/forgot-password` - Solicitar código
- `POST /api/auth/reset-password` - Restablecer contraseña
- `POST /api/auth/change-password` - Cambiar contraseña

#### Configuración de Organizaciones
- `GET /api/donation-days` - Ver días de donación
- `PUT /api/donation-days` - Actualizar días

### Middleware

#### authenticateToken
Verifica el token JWT en cada petición protegida.

**Funcionamiento:**
1. Extrae token del header Authorization
2. Verifica token con JWT_SECRET
3. Decodifica y agrega `req.user`
4. Permite continuar o retorna 401/403

**Uso:**
\`\`\`javascript
app.get('/api/protected', authenticateToken, (req, res) => {
  // req.user contiene datos del usuario
})
\`\`\`

### Manejo de Errores

El servidor implementa manejo de errores consistente:

**Códigos de Error:**
- `400` - Datos inválidos o faltantes
- `401` - Token inválido o expirado
- `403` - Sin permisos para la acción
- `404` - Recurso no encontrado
- `500` - Error interno del servidor

**Formato de Respuesta de Error:**
\`\`\`json
{
  "error": "Descripción del error"
}
\`\`\`

### Logging

El servidor incluye logs detallados para debugging:

\`\`\`javascript
console.log('🚀 Servidor ejecutándose en puerto', PORT)
console.log('📊 [BACKEND] Calculando estadísticas...')
console.log('✅ [BACKEND] Operación exitosa')
console.log('❌ [BACKEND] Error:', error.message)
\`\`\`

### Base de Datos

#### Inicialización
Al iniciar, el servidor:
1. Conecta a la base de datos
2. Crea tablas si no existen
3. Verifica conexión
4. Registra estado en logs

#### Queries Optimizadas
- Uso de prepared statements para prevenir SQL injection
- Índices en campos frecuentemente consultados
- Joins eficientes para relaciones

#### Transacciones
Para operaciones críticas como reservas:
1. Inicia transacción
2. Verifica disponibilidad
3. Actualiza estado
4. Commit o rollback según resultado
