import { Socket, createConnection } from 'node:net'
import { TLSSocket, connect as tlsConnect } from 'node:tls'
import type { OverlayConfigType } from '@/lib/config/schema'

export type SmtpConfig = OverlayConfigType['enterprise']['smtp']

export function getSmtpStatus(config: SmtpConfig): { configured: boolean; message: string } {
  if (!config.host) return { configured: false, message: 'SMTP host is not configured.' }
  if (!config.from) return { configured: false, message: 'SMTP from address is not configured.' }
  return { configured: true, message: `${config.host}:${config.port}` }
}

export async function sendSmtpEmail(config: SmtpConfig, message: {
  to: string
  subject: string
  text: string
}): Promise<void> {
  const status = getSmtpStatus(config)
  if (!status.configured) throw new Error(status.message)
  const socket = await connect(config)
  try {
    await expect(socket, 220)
    await command(socket, `EHLO ${config.heloName || 'overlay.local'}`, 250)
    if (config.username && config.password) {
      await command(socket, 'AUTH LOGIN', 334)
      await command(socket, Buffer.from(config.username).toString('base64'), 334)
      await command(socket, Buffer.from(config.password).toString('base64'), 235)
    }
    await command(socket, `MAIL FROM:<${config.from}>`, 250)
    await command(socket, `RCPT TO:<${message.to}>`, 250)
    await command(socket, 'DATA', 354)
    await write(socket, [
      `From: ${config.from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject.replace(/\r?\n/g, ' ')}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.text,
      '.',
      '',
    ].join('\r\n'))
    await expect(socket, 250)
    await command(socket, 'QUIT', 221).catch(() => {})
  } finally {
    socket.destroy()
  }
}

async function connect(config: SmtpConfig): Promise<Socket | TLSSocket> {
  const port = config.port ?? (config.secure ? 465 : 25)
  const socket = config.secure
    ? tlsConnect({ host: config.host!, port })
    : createConnection({ host: config.host!, port })
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('secureConnect', resolve)
    socket.once('error', reject)
  })
  return socket
}

async function command(socket: Socket | TLSSocket, line: string, code: number): Promise<string> {
  await write(socket, `${line}\r\n`)
  return expect(socket, code)
}

async function write(socket: Socket | TLSSocket, data: string): Promise<void> {
  await new Promise<void>((resolve, reject) => socket.write(data, (error) => error ? reject(error) : resolve()))
}

async function expect(socket: Socket | TLSSocket, code: number): Promise<string> {
  const line = await new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      cleanup()
      resolve(chunk.toString('utf8'))
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
    }
    socket.once('data', onData)
    socket.once('error', onError)
  })
  if (!line.startsWith(String(code))) throw new Error(`SMTP expected ${code}, got ${line.trim()}`)
  return line
}
