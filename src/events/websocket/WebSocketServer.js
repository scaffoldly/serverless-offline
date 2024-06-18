import crypto from "node:crypto"
import { WebSocketServer as WsWebSocketServer } from "ws"
import { log } from "../../utils/log.js"

export default class WebSocketServer {
  #connectionIds = new Map()

  #options = null

  #sharedListener = null

  #webSocketClients = null

  constructor(options, webSocketClients, sharedListener) {
    this.#options = options
    this.#sharedListener = sharedListener
    this.#webSocketClients = webSocketClients
  }

  async createServer() {
    const server = new WsWebSocketServer({
      server: this.#sharedListener,
      verifyClient: async ({ req }, cb) => {
        const connectionId = crypto.randomUUID()
        const key = req.headers["sec-websocket-key"]

        log.debug(`verifyClient:${key} ${connectionId}`)

        // use the websocket key to correlate connection IDs
        this.#connectionIds.set(key, connectionId)

        const { headers, message, statusCode, verified } =
          await this.#webSocketClients.verifyClient(connectionId, req)

        try {
          if (!verified) {
            cb(false, statusCode, message, headers)
            return
          }
          cb(true)
        } catch (err) {
          log.debug(`Error verifying`, err)
          cb(false)
        }
      },
    })

    server.on("connection", (webSocketClient, request) => {
      log.notice("received connection")

      const { headers } = request
      const key = headers["sec-websocket-key"]

      const connectionId = this.#connectionIds.get(key)

      log.debug(`connect:${connectionId}`)

      this.#webSocketClients.addClient(webSocketClient, connectionId)
    })
  }

  async start() {
    const { host, httpsProtocol, websocketPort } = this.#options

    log.notice(
      `Offline [websocket] listening on ${
        httpsProtocol ? "wss" : "ws"
      }://${host}:${websocketPort}`,
    )
  }

  // no-op, we're re-using the http server
  stop() {}

  addRoute(functionKey, webSocketEvent) {
    this.#webSocketClients.addRoute(functionKey, webSocketEvent)
  }
}
