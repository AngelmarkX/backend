const express = require("express")
const mysql = require("mysql2/promise")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const crypto = require("crypto")
const fetch = require("node-fetch") // Added for Mailjet API
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Configuración de base de datos
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "food_donation_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

const pool = mysql.createPool(dbConfig)

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido" })
  }

  jwt.verify(token, process.env.JWT_SECRET || "secret_key", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" })
    }
    req.user = user
    next()
  })
}

// Función para limpiar y validar donación
const cleanDonation = (donation) => {
  if (!donation || typeof donation !== "object") {
    return null
  }

  if (!donation.id || !donation.title || !donation.category) {
    return null
  }

  let lat = Number.parseFloat(donation.pickup_latitude)
  let lng = Number.parseFloat(donation.pickup_longitude)

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    lat = 4.8133 + (Math.random() - 0.5) * 0.02
    lng = -75.6961 + (Math.random() - 0.5) * 0.02
  }

  return {
    id: Number.parseInt(donation.id),
    title: String(donation.title).trim(),
    description: String(donation.description || "").trim(),
    category: String(donation.category).toLowerCase().trim(),
    quantity: Number.parseInt(donation.quantity) || 1,
    weight: donation.weight ? Number.parseFloat(donation.weight) : null,
    donation_reason: donation.donation_reason ? String(donation.donation_reason).trim() : null,
    contact_info: donation.contact_info ? String(donation.contact_info).trim() : null,
    expiry_date: donation.expiry_date || null,
    pickup_address: String(donation.pickup_address || "").trim(),
    pickup_latitude: Number.parseFloat(lat.toFixed(6)),
    pickup_longitude: Number.parseFloat(lng.toFixed(6)),
    latitude: Number.parseFloat(lat.toFixed(6)),
    longitude: Number.parseFloat(lng.toFixed(6)),
    status: String(donation.status || "available").toLowerCase(),
    donor_id: Number.parseInt(donation.donor_id) || null,
    donor_name: String(donation.donor_name || "Donante anónimo").trim(),
    donor_phone: donation.donor_phone ? String(donation.donor_phone).trim() : null,
    donor_email: donation.donor_email ? String(donation.donor_email).trim() : null,
    reserved_by: donation.reserved_by ? Number.parseInt(donation.reserved_by) : null,
    reserved_at: donation.reserved_at || null,
    completed_at: donation.completed_at || null,
    created_at: donation.created_at || new Date().toISOString(),
    updated_at: donation.updated_at || new Date().toISOString(),
    donor_confirmed: Boolean(donation.donor_confirmed || false),
    recipient_confirmed: Boolean(donation.recipient_confirmed || false),
    donor_confirmed_at: donation.donor_confirmed_at || null,
    recipient_confirmed_at: donation.recipient_confirmed_at || null,
    pickup_time: donation.pickup_time ? String(donation.pickup_time).trim() : null,
    pickup_person_name: donation.pickup_person_name ? String(donation.pickup_person_name).trim() : null,
    pickup_person_id: donation.pickup_person_id ? String(donation.pickup_person_id).trim() : null,
    verification_code: donation.verification_code ? String(donation.verification_code).trim() : null,
    business_confirmed: donation.business_confirmed !== null ? Boolean(donation.business_confirmed) : null,
    business_confirmed_at: donation.business_confirmed_at || null,
  }
}

const createEmailTransporter = async (toEmail, subject, htmlContent) => {
  if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
    console.warn("⚠️ Variables de Mailjet no configuradas. Los códigos se mostrarán en consola.")
    return null
  }

  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`).toString("base64")}`,
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL || "noreply@tuapp.com",
              Name: "App Donaciones",
            },
            To: [
              {
                Email: toEmail,
              },
            ],
            Subject: subject,
            HTMLPart: htmlContent,
          },
        ],
      }),
    })

    return response
  } catch (error) {
    console.error("Error enviando email con Mailjet:", error)
    return null
  }
}

// Rutas de autenticación
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" })
    }

    const [users] = await pool.execute("SELECT id, email, password, name, user_type FROM users WHERE email = ?", [
      email,
    ])

    if (!users || users.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" })
    }

    const user = users[0]
    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.user_type },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "24h" },
    )

    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
      },
    })
  } catch (error) {
    console.error("Error en login:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, phone, userType, address } = req.body

    if (!email || !password || !name || !phone || !userType) {
      return res.status(400).json({ error: "Todos los campos requeridos deben ser completados" })
    }

    const [existingUsers] = await pool.execute("SELECT id FROM users WHERE email = ?", [email])

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: "El usuario ya existe" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.execute(
      "INSERT INTO users (email, password, name, phone, user_type, address) VALUES (?, ?, ?, ?, ?, ?)",
      [email, hashedPassword, name, phone, userType, address || ""],
    )

    const token = jwt.sign({ id: result.insertId, email, userType }, process.env.JWT_SECRET || "secret_key", {
      expiresIn: "24h",
    })

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      user: {
        id: result.insertId,
        email,
        name,
        userType,
      },
    })
  } catch (error) {
    console.error("Error en registro:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Solicitar recuperación de contraseña
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email es requerido" })
    }

    const [users] = await pool.execute("SELECT id, email, name FROM users WHERE email = ?", [email])

    if (!users || users.length === 0) {
      return res.json({
        message: "Si el email existe, recibirás un código de recuperación",
      })
    }

    const user = users[0]
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await pool.execute("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [
      resetCode,
      expiresAt,
      user.id,
    ])

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .code { background: #fff; border: 2px dashed #4CAF50; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperación de Contraseña</h1>
          </div>
          <div class="content">
            <p>Hola ${user.name},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
            <div class="code">${resetCode}</div>
            <p><strong>Este código expira en 15 minutos.</strong></p>
            <p>Si no solicitaste este cambio, ignora este mensaje.</p>
          </div>
          <div class="footer">
            <p>App de Donaciones de Alimentos</p>
          </div>
        </div>
      </body>
      </html>
    `

    const emailResponse = await createEmailTransporter(email, "Código de Recuperación de Contraseña", htmlContent)

    if (emailResponse && emailResponse.ok) {
      console.log("\n✅ Email enviado exitosamente a:", email)
      res.json({ message: "Código de recuperación enviado a tu email" })
    } else {
      console.log("\n" + "=".repeat(60))
      console.log("📧 CÓDIGO DE RECUPERACIÓN (Email falló)")
      console.log("=".repeat(60))
      console.log(`Usuario: ${user.name} (${email})`)
      console.log(`Código: ${resetCode}`)
      console.log(`Expira: ${expiresAt.toLocaleString()}`)
      console.log("=".repeat(60) + "\n")

      res.json({
        message: "Código generado (revisa con el administrador)",
        code: resetCode,
        devMode: true,
      })
    }
  } catch (error) {
    console.error("Error en forgot-password:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Restablecer contraseña con código
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, código y nueva contraseña son requeridos" })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" })
    }

    const [users] = await pool.execute("SELECT id, reset_token, reset_token_expires FROM users WHERE email = ?", [
      email,
    ])

    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Código inválido o expirado" })
    }

    const user = users[0]

    if (!user.reset_token || user.reset_token !== code) {
      return res.status(400).json({ error: "Código inválido o expirado" })
    }

    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ error: "Código expirado" })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await pool.execute("UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", [
      hashedPassword,
      user.id,
    ])

    res.json({ message: "Contraseña actualizada exitosamente" })
  } catch (error) {
    console.error("Error en reset-password:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.put("/api/users/profile", authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, donation_days } = req.body

    console.log("📝 [BACKEND] Actualizando perfil usuario:", {
      userId: req.user.id,
      name,
      email,
      phone,
      address,
      hasDonationDays: !!donation_days,
      donation_days_data: donation_days,
    })

    if (!name || !email) {
      return res.status(400).json({ error: "Nombre y email son obligatorios" })
    }

    const [existingUsers] = await pool.execute("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user.id])

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: "Este email ya está en uso por otro usuario" })
    }

    let updateQuery = `UPDATE users SET 
      name = ?, 
      email = ?, 
      phone = ?, 
      address = ?`

    const params = [name.trim(), email.trim(), phone ? phone.trim() : null, address ? address.trim() : null]

    if (donation_days !== undefined) {
      updateQuery += `, donation_days = ?`
      const jsonString = JSON.stringify(donation_days)
      params.push(jsonString)
      console.log("💾 [BACKEND] Saving donation_days as JSON:", jsonString)
    }

    updateQuery += ` WHERE id = ?`
    params.push(req.user.id)

    console.log("🔍 [BACKEND] SQL Query:", updateQuery)
    console.log("🔍 [BACKEND] SQL Params:", params)

    const [result] = await pool.execute(updateQuery, params)

    console.log("📊 [BACKEND] Update result:", {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
    })

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    const [updatedUser] = await pool.execute(
      "SELECT id, email, name, phone, address, user_type, donation_days FROM users WHERE id = ?",
      [req.user.id],
    )

    console.log("📖 [BACKEND] User from DB after update:", {
      id: updatedUser[0].id,
      donation_days_raw: updatedUser[0].donation_days,
      donation_days_type: typeof updatedUser[0].donation_days,
    })

    if (updatedUser[0].donation_days) {
      try {
        updatedUser[0].donation_days = JSON.parse(updatedUser[0].donation_days)
        console.log("✅ [BACKEND] Parsed donation_days successfully")
      } catch (e) {
        console.error("❌ [BACKEND] Error parsing donation_days:", e)
        updatedUser[0].donation_days = null
      }
    }

    console.log("✅ [BACKEND] Perfil actualizado exitosamente")

    res.json({
      message: "Perfil actualizado exitosamente",
      user: updatedUser[0],
    })
  } catch (error) {
    console.error("❌ [BACKEND] Error actualizando perfil:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.get("/api/users/profile", authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      "SELECT id, email, name, phone, address, user_type, donation_days FROM users WHERE id = ?",
      [req.user.id],
    )

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" })
    }

    const user = users[0]

    if (user.donation_days) {
      try {
        user.donation_days = JSON.parse(user.donation_days)
      } catch (e) {
        user.donation_days = null
      }
    }

    res.json({ user })
  } catch (error) {
    console.error("❌ [BACKEND] Error obteniendo perfil:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Rutas de donaciones
app.get("/api/donations", authenticateToken, async (req, res) => {
  try {
    const { status, category, reserved_by } = req.query

    let query = `
      SELECT 
        d.id,
        d.title,
        d.description,
        d.category,
        d.quantity,
        d.weight,
        d.donation_reason,
        d.contact_info,
        d.expiry_date,
        d.pickup_address,
        d.pickup_latitude,
        d.pickup_longitude,
        d.status,
        d.donor_id,
        d.reserved_by,
        d.reserved_at,
        d.completed_at,
        d.created_at,
        d.updated_at,
        COALESCE(d.donor_confirmed, FALSE) as donor_confirmed,
        COALESCE(d.recipient_confirmed, FALSE) as recipient_confirmed,
        d.donor_confirmed_at,
        d.recipient_confirmed_at,
        d.pickup_time,
        d.pickup_person_name,
        d.pickup_person_id,
        d.verification_code,
        d.business_confirmed,
        d.business_confirmed_at,
        u.name as donor_name,
        u.phone as donor_phone,
        u.email as donor_email
      FROM donations d 
      LEFT JOIN users u ON d.donor_id = u.id
      WHERE d.title IS NOT NULL 
        AND d.title != ''
        AND d.category IS NOT NULL 
        AND d.category != ''
        AND d.quantity > 0
        AND d.pickup_latitude IS NOT NULL 
        AND d.pickup_longitude IS NOT NULL
        AND d.pickup_latitude != 0 
        AND d.pickup_longitude != 0
    `

    const params = []

    if (status) {
      query += " AND d.status = ?"
      params.push(status)
    }

    if (category) {
      query += " AND d.category = ?"
      params.push(category)
    }

    if (reserved_by) {
      query += " AND d.reserved_by = ?"
      params.push(Number.parseInt(reserved_by))
    }

    query += " ORDER BY d.created_at DESC LIMIT 50"

    const [rows] = await pool.execute(query, params)

    if (!Array.isArray(rows)) {
      return res.json([])
    }

    const cleanDonations = rows.map(cleanDonation).filter((donation) => donation !== null)

    res.json(cleanDonations)
  } catch (error) {
    console.error("Error obteniendo donaciones:", error)
    res.status(500).json({ error: "Error interno del servidor", donations: [] })
  }
})

app.get("/api/donations/my", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        d.*,
        COALESCE(d.donor_confirmed, FALSE) as donor_confirmed,
        COALESCE(d.recipient_confirmed, FALSE) as recipient_confirmed,
        u.name as donor_name,
        u.phone as donor_phone,
        u.email as donor_email,
        CASE 
          WHEN d.donor_id = ? THEN 'given'
          WHEN d.reserved_by = ? THEN 'received'
          ELSE 'other'
        END as donation_type
      FROM donations d 
      LEFT JOIN users u ON d.donor_id = u.id
      WHERE d.donor_id = ? OR d.reserved_by = ?
      ORDER BY d.created_at DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id],
    )

    if (!Array.isArray(rows)) {
      return res.json([])
    }

    const cleanDonations = rows.map(cleanDonation).filter((donation) => donation !== null)

    res.json(cleanDonations)
  } catch (error) {
    console.error("Error obteniendo mis donaciones:", error)
    res.status(500).json({ error: "Error interno del servidor", donations: [] })
  }
})

app.post("/api/donations", authenticateToken, async (req, res) => {
  try {
    console.log("📥 [BACKEND] Datos recibidos para crear donación:", req.body)

    const {
      title,
      description,
      category,
      quantity,
      weight,
      donation_reason,
      contact_info,
      expiry_date,
      pickup_address,
      latitude,
      longitude,
      pickup_latitude,
      pickup_longitude,
    } = req.body

    if (!title || !description || !category || !quantity) {
      console.error("❌ [BACKEND] Campos faltantes:", {
        title: !!title,
        description: !!description,
        category: !!category,
        quantity: !!quantity,
      })
      return res.status(400).json({
        error: "Los campos título, descripción, categoría y cantidad son requeridos",
      })
    }

    const finalLatitude = pickup_latitude || latitude
    const finalLongitude = pickup_longitude || longitude

    if (!finalLatitude || !finalLongitude) {
      console.error("❌ [BACKEND] Coordenadas faltantes:", {
        latitude,
        longitude,
        pickup_latitude,
        pickup_longitude,
        finalLatitude,
        finalLongitude,
      })
      return res.status(400).json({
        error: "Las coordenadas de ubicación son requeridas",
      })
    }

    const lat = Number.parseFloat(finalLatitude)
    const lng = Number.parseFloat(finalLongitude)

    if (isNaN(lat) || isNaN(lng)) {
      console.error("❌ [BACKEND] Coordenadas inválidas:", {
        finalLatitude,
        finalLongitude,
        lat,
        lng,
      })
      return res.status(400).json({
        error: "Las coordenadas deben ser números válidos",
      })
    }

    const address = pickup_address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`

    console.log("✅ [BACKEND] Datos validados:", {
      title,
      description,
      category,
      quantity: Number.parseInt(quantity),
      weight: weight ? Number.parseFloat(weight) : null,
      donation_reason,
      contact_info,
      expiry_date,
      address,
      coordinates: { lat, lng },
    })

    const [result] = await pool.execute(
      `INSERT INTO donations (
        donor_id, title, description, category, quantity, weight, 
        donation_reason, contact_info, expiry_date, 
        pickup_address, pickup_latitude, pickup_longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title.trim(),
        description.trim(),
        category.toLowerCase().trim(),
        Number.parseInt(quantity),
        weight ? Number.parseFloat(weight) : null,
        donation_reason ? donation_reason.trim() : null,
        contact_info ? contact_info.trim() : null,
        expiry_date || null,
        address.trim(),
        Number.parseFloat(lat.toFixed(6)),
        Number.parseFloat(lng.toFixed(6)),
        "available",
      ],
    )

    console.log("✅ [BACKEND] Donación creada con ID:", result.insertId)

    res.status(201).json({
      message: "Donación creada exitosamente",
      donationId: result.insertId,
      coordinates: {
        latitude: Number.parseFloat(lat.toFixed(6)),
        longitude: Number.parseFloat(lng.toFixed(6)),
      },
    })
  } catch (error) {
    console.error("❌ [BACKEND] Error creando donación:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/donations/batch", authenticateToken, async (req, res) => {
  try {
    console.log("📥 [BACKEND] Datos recibidos para crear donaciones en lote:", req.body)

    const { donations } = req.body

    if (!Array.isArray(donations) || donations.length === 0) {
      return res.status(400).json({
        error: "Debe proporcionar un array de donaciones",
      })
    }

    if (donations.length > 20) {
      return res.status(400).json({
        error: "No se pueden crear más de 20 donaciones a la vez",
      })
    }

    for (let i = 0; i < donations.length; i++) {
      const donation = donations[i]

      if (!donation.title || !donation.description || !donation.category || !donation.quantity) {
        return res.status(400).json({
          error: `Donación ${i + 1}: Los campos título, descripción, categoría y cantidad son requeridos`,
        })
      }

      const finalLatitude = donation.pickup_latitude || donation.latitude
      const finalLongitude = donation.pickup_longitude || donation.longitude

      if (!finalLatitude || !finalLongitude) {
        return res.status(400).json({
          error: `Donación ${i + 1}: Las coordenadas de ubicación son requeridas`,
        })
      }

      const lat = Number.parseFloat(finalLatitude)
      const lng = Number.parseFloat(finalLongitude)

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          error: `Donación ${i + 1}: Las coordenadas deben ser números válidos`,
        })
      }
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      const createdIds = []

      for (const donation of donations) {
        const finalLatitude = donation.pickup_latitude || donation.latitude
        const finalLongitude = donation.pickup_longitude || donation.longitude
        const lat = Number.parseFloat(finalLatitude)
        const lng = Number.parseFloat(finalLongitude)
        const address = donation.pickup_address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`

        const [result] = await connection.execute(
          `INSERT INTO donations (
            donor_id, title, description, category, quantity, weight, 
            donation_reason, contact_info, expiry_date, 
            pickup_address, pickup_latitude, pickup_longitude, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            donation.title.trim(),
            donation.description.trim(),
            donation.category.toLowerCase().trim(),
            Number.parseInt(donation.quantity),
            donation.weight ? Number.parseFloat(donation.weight) : null,
            donation.donation_reason ? donation.donation_reason.trim() : null,
            donation.contact_info ? donation.contact_info.trim() : null,
            donation.expiry_date || null,
            address.trim(),
            Number.parseFloat(lat.toFixed(6)),
            Number.parseFloat(lng.toFixed(6)),
            "available",
          ],
        )

        createdIds.push(result.insertId)
      }

      await connection.commit()
      connection.release()

      console.log("✅ [BACKEND] Donaciones creadas en lote con IDs:", createdIds)

      res.status(201).json({
        message: `${createdIds.length} donaciones creadas exitosamente`,
        donationIds: createdIds,
        count: createdIds.length,
      })
    } catch (error) {
      await connection.rollback()
      connection.release()
      throw error
    }
  } catch (error) {
    console.error("❌ [BACKEND] Error creando donaciones en lote:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/donations/:id/reserve", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { pickup_time, pickup_person_name, pickup_person_id } = req.body

    console.log("📥 [BACKEND] Reservando donación con detalles:", {
      id,
      pickup_time,
      pickup_person_name,
      pickup_person_id,
      user_id: req.user.id,
    })

    if (!id || isNaN(Number.parseInt(id))) {
      return res.status(400).json({ error: "ID de donación inválido" })
    }

    if (req.user.userType !== "organization") {
      return res.status(403).json({ error: "Solo las organizaciones pueden reservar donaciones" })
    }

    if (!pickup_time || !pickup_person_name || !pickup_person_id) {
      return res.status(400).json({
        error: "Debe proporcionar hora de recogida, nombre de la persona y cédula",
      })
    }

    if (pickup_person_id.length < 6 || pickup_person_id.length > 20) {
      return res.status(400).json({
        error: "La cédula debe tener entre 6 y 20 caracteres",
      })
    }

    const [donations] = await pool.execute("SELECT id, donor_id FROM donations WHERE id = ? AND status = 'available'", [
      Number.parseInt(id),
    ])

    if (!donations || donations.length === 0) {
      return res.status(400).json({ error: "Donación no disponible para reservar" })
    }

    const verification_code = Math.floor(100000 + Math.random() * 900000).toString()

    console.log("🔐 [BACKEND] Código de verificación generado:", verification_code)

    const [result] = await pool.execute(
      `UPDATE donations SET 
        status = 'reserved', 
        reserved_by = ?, 
        reserved_at = NOW(),
        pickup_time = ?,
        pickup_person_name = ?,
        pickup_person_id = ?,
        verification_code = ?,
        business_confirmed = FALSE
      WHERE id = ?`,
      [
        req.user.id,
        pickup_time,
        pickup_person_name.trim(),
        pickup_person_id.trim(),
        verification_code,
        Number.parseInt(id),
      ],
    )

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "No se pudo reservar la donación" })
    }

    console.log("✅ [BACKEND] Donación reservada exitosamente")

    res.json({
      message: "Donación reservada exitosamente. Esperando confirmación del comercio.",
      verification_code: verification_code,
      pickup_time: pickup_time,
      pickup_person_name: pickup_person_name,
    })
  } catch (error) {
    console.error("❌ [BACKEND] Error reservando donación:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/donations/:id/business-confirm", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { accept } = req.body

    console.log("📥 [BACKEND] Confirmación de comercio:", {
      id,
      accept,
      user_id: req.user.id,
    })

    if (!id || isNaN(Number.parseInt(id))) {
      return res.status(400).json({ error: "ID de donación inválido" })
    }

    if (typeof accept !== "boolean") {
      return res.status(400).json({ error: "Debe especificar si acepta o rechaza" })
    }

    const [donations] = await pool.execute(
      `SELECT id, donor_id, reserved_by, status, business_confirmed 
       FROM donations WHERE id = ?`,
      [Number.parseInt(id)],
    )

    if (!donations || donations.length === 0) {
      return res.status(404).json({ error: "Donación no encontrada" })
    }

    const donation = donations[0]

    if (donation.donor_id !== req.user.id) {
      return res.status(403).json({ error: "Solo el donante puede confirmar la hora de recogida" })
    }

    if (donation.status !== "reserved") {
      return res.status(400).json({ error: "La donación debe estar reservada" })
    }

    if (donation.business_confirmed) {
      return res.status(400).json({ error: "Ya confirmaste esta reserva" })
    }

    if (accept) {
      const [result] = await pool.execute(
        `UPDATE donations SET 
          business_confirmed = TRUE, 
          business_confirmed_at = NOW() 
        WHERE id = ?`,
        [Number.parseInt(id)],
      )

      if (result.affectedRows === 0) {
        return res.status(400).json({ error: "No se pudo confirmar la reserva" })
      }

      console.log("✅ [BACKEND] Comercio aceptó la hora de recogida")

      res.json({
        message: "Hora de recogida aceptada. La organización puede proceder con la recogida.",
      })
    } else {
      const [result] = await pool.execute(
        `UPDATE donations SET 
          status = 'available',
          reserved_by = NULL,
          reserved_at = NULL,
          pickup_time = NULL,
          pickup_person_name = NULL,
          pickup_person_id = NULL,
          verification_code = NULL,
          business_confirmed = FALSE,
          business_confirmed_at = NULL
        WHERE id = ?`,
        [Number.parseInt(id)],
      )

      if (result.affectedRows === 0) {
        return res.status(400).json({ error: "No se pudo rechazar la reserva" })
      }

      console.log("❌ [BACKEND] Comercio rechazó la hora de recogida")

      res.json({
        message: "Reserva rechazada. La donación está disponible nuevamente.",
      })
    }
  } catch (error) {
    console.error("❌ [BACKEND] Error en confirmación de comercio:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/donations/:id/confirm", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { verification_code } = req.body

    console.log("📥 [BACKEND] Confirmando donación:", {
      id,
      verification_code,
      user_id: req.user.id,
    })

    if (!id || isNaN(Number.parseInt(id))) {
      return res.status(400).json({ error: "ID de donación inválido" })
    }

    if (!verification_code) {
      return res.status(400).json({ error: "Código de verificación requerido" })
    }

    const [donations] = await pool.execute(
      `SELECT id, donor_id, reserved_by, status, verification_code,
       COALESCE(donor_confirmed, FALSE) as donor_confirmed,
       COALESCE(recipient_confirmed, FALSE) as recipient_confirmed,
       COALESCE(business_confirmed, FALSE) as business_confirmed
       FROM donations WHERE id = ?`,
      [Number.parseInt(id)],
    )

    if (!donations || donations.length === 0) {
      return res.status(404).json({ error: "Donación no encontrada" })
    }

    const donation = donations[0]

    if (donation.status !== "reserved") {
      return res.status(400).json({ error: "La donación debe estar reservada para confirmar" })
    }

    if (!donation.business_confirmed) {
      return res.status(400).json({
        error: "El comercio aún no ha aceptado la hora de recogida",
      })
    }

    if (donation.verification_code !== verification_code.trim()) {
      return res.status(400).json({ error: "Código de verificación incorrecto" })
    }

    let updateQuery = ""
    let message = ""

    if (donation.donor_id === req.user.id) {
      if (donation.donor_confirmed) {
        return res.status(400).json({ error: "Ya confirmaste esta donación" })
      }
      updateQuery = "UPDATE donations SET donor_confirmed = TRUE, donor_confirmed_at = NOW()"
      message = "Confirmación de donante registrada"
    } else if (donation.reserved_by === req.user.id) {
      if (donation.recipient_confirmed) {
        return res.status(400).json({ error: "Ya confirmaste esta donación" })
      }
      updateQuery = "UPDATE donations SET recipient_confirmed = TRUE, recipient_confirmed_at = NOW()"
      message = "Confirmación de organización registrada"
    } else {
      return res.status(403).json({ error: "No tienes permisos para confirmar esta donación" })
    }

    const bothConfirmed =
      (donation.donor_confirmed || donation.donor_id === req.user.id) &&
      (donation.recipient_confirmed || donation.reserved_by === req.user.id)

    if (bothConfirmed) {
      updateQuery += ", status = 'completed', completed_at = NOW()"
      message = "¡Donación completada! Ambas partes confirmaron"
    }

    updateQuery += " WHERE id = ?"

    const [result] = await pool.execute(updateQuery, [Number.parseInt(id)])

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "No se pudo confirmar la donación" })
    }

    console.log("✅ [BACKEND] Confirmación exitosa")

    res.json({ message })
  } catch (error) {
    console.error("❌ [BACKEND] Error confirmando donación:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    console.log("📊 [BACKEND] Calculando estadísticas para usuario:", {
      id: req.user.id,
      userType: req.user.userType,
    })

    let stats = {
      totalDonations: 0,
      activeDonations: 0,
      completedDonations: 0,
      impactScore: 0,
    }

    if (req.user.userType === "donor") {
      const [totalDonations] = await pool.execute("SELECT COUNT(*) as count FROM donations WHERE donor_id = ?", [
        req.user.id,
      ])
      const [completedDonations] = await pool.execute(
        "SELECT COUNT(*) as count FROM donations WHERE donor_id = ? AND status = 'completed'",
        [req.user.id],
      )
      const [activeDonations] = await pool.execute(
        "SELECT COUNT(*) as count FROM donations WHERE donor_id = ? AND status IN ('available', 'reserved')",
        [req.user.id],
      )

      stats = {
        totalDonations: totalDonations[0]?.count || 0,
        completedDonations: completedDonations[0]?.count || 0,
        activeDonations: activeDonations[0]?.count || 0,
        impactScore: (completedDonations[0]?.count || 0) * 10,
      }
    } else if (req.user.userType === "organization") {
      const [totalReserved] = await pool.execute("SELECT COUNT(*) as count FROM donations WHERE reserved_by = ?", [
        req.user.id,
      ])
      const [completedDonations] = await pool.execute(
        "SELECT COUNT(*) as count FROM donations WHERE reserved_by = ? AND status = 'completed'",
        [req.user.id],
      )
      const [activeDonations] = await pool.execute(
        "SELECT COUNT(*) as count FROM donations WHERE reserved_by = ? AND status = 'reserved'",
        [req.user.id],
      )

      stats = {
        totalDonations: totalReserved[0]?.count || 0,
        completedDonations: completedDonations[0]?.count || 0,
        activeDonations: activeDonations[0]?.count || 0,
        impactScore: (completedDonations[0]?.count || 0) * 10,
      }
    }

    console.log("📊 [BACKEND] Estadísticas calculadas:", stats)
    res.json(stats)
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Endpoint para obtener directorio de usuarios
app.get("/api/users/directory", authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT 
        id, name, phone, user_type, address, donation_days 
      FROM users 
      WHERE id != ? 
      ORDER BY name ASC`,
      [req.user.id],
    )

    const usersWithDays = users.map((user) => {
      if (user.donation_days) {
        try {
          // Si es string, parsearlo
          if (typeof user.donation_days === "string") {
            user.donation_days = JSON.parse(user.donation_days)
          }
          // Si ya es objeto, dejarlo como está
        } catch (e) {
          console.error(`Error parsing donation_days for user ${user.id}:`, e)
          user.donation_days = null
        }
      } else {
        user.donation_days = null
      }
      return user
    })

    res.json(usersWithDays)
  } catch (error) {
    console.error("Error obteniendo directorio:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.get("/api/test", (req, res) => {
  res.json({
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
    status: "OK",
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`)
})
