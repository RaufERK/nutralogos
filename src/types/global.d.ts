declare global {
  var wsClients: Map<string, any> | undefined
  var sendToWSClient: ((clientId: string, message: any) => boolean) | undefined
}

export {}
