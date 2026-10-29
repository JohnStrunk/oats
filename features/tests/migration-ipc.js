import net from 'node:net'

// Unlike an uncancellable retry loop, an aborted attempt never reconnects to
// a socket that appears later (connecting can itself cause target startup).
export async function connectUntil(socketPath, signal) {
  while (true) {
    if (signal.aborted) throw signal.reason
    try {
      const socket = await new Promise((resolve, reject) => {
        const connection = net.connect(socketPath)
        function cancel() { connection.destroy(); reject(signal.reason) }
        function failed(error) { signal.removeEventListener('abort', cancel); reject(error) }
        signal.addEventListener('abort', cancel, { once: true })
        connection.once('error', failed)
        connection.once('connect', () => {
          signal.removeEventListener('abort', cancel)
          connection.off('error', failed)
          if (signal.aborted) { connection.destroy(); reject(signal.reason); return }
          connection.on('error', () => {})
          resolve(connection)
        })
        if (signal.aborted) cancel()
      })
      return wrapSocket(socket)
    } catch (error) {
      if (signal.aborted) throw signal.reason
      if (error.code !== 'ENOENT' && error.code !== 'ECONNREFUSED') throw error
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, 20)
        function cancel() { clearTimeout(timer); reject(signal.reason) }
        signal.addEventListener('abort', cancel, { once: true })
        if (signal.aborted) cancel()
      })
    }
  }
}

function wrapSocket(socket) {
  const listeners = new Set()
  const history = []
  let buffer = ''
  socket.setEncoding('utf8')
  socket.on('data', chunk => {
    buffer += chunk
    let newline
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      let message
      try { message = JSON.parse(line) } catch { continue }
      history.push(message)
      for (const listener of listeners) listener(message)
    }
  })
  return {
    send(message) { socket.write(`${JSON.stringify(message)}\n`) },
    onMessage(listener) { for (const message of history) listener(message); listeners.add(listener) },
    close() { socket.destroy() },
    closed: new Promise(resolve => socket.once('close', resolve)),
  }
}
