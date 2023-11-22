const WebSocket = require('ws')
var wss

module.exports = (server) => {
	wss = new WebSocket.Server({
		server
	})

	wss.on('connection', onConnection)

	console.log('______________________________')
	console.log('')
	console.log(`✔ Servidor Web Socket rodando`)
	return wss
}

function getUniqueId() {
	function getIdPart() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
	}
	let Id = getIdPart() + getIdPart() + '-' + getIdPart()
	if (Array.from(wss.clients).length > 0) {
		while (Array.from(wss.clients).find(client => client._id == Id))
			Id = getIdPart() + getIdPart() + '-' + getIdPart()
	}
	return Id
}

function onError(ws, err) {
	console.error(`Error: ${ err.message }`)
}

let messages = []
function onMessage(ws, data) {
	data = JSON.parse(data)
	if (data.type == 'command')
		executeCode(data, ws)
	else {
		let sendingData = {
			type: 'message',
			from: ws.name,
			to: data.to,
			message: data.message
		}
		messages.push(sendingData)

		if (data.to == 'all') {
			Array.from(wss.clients).map(client => {
				client.send(JSON.stringify(sendingData))
			})
		}
		else {
			Array.from(wss.clients).filter(client => client.name == data.to || client.name == ws.name).map((client) => {
				client.send(JSON.stringify(sendingData))
			})
		}
	}
}

async function onConnection(ws, req) {
	ws._id = await getUniqueId()

	console.log(`Novo cliente conectado. Id: `, ws._id)

	ws.on('message', data => onMessage(ws, data))
	ws.on('error', error => onError(ws, error))
	ws.on('close', () => onClose(ws))
}

function onClose(ws) {
	if (ws.name) {
		console.log(`${ ws.name } desconectou.`)

		let clients = Array.from(wss.clients).map(client => {
			return client.name
		})

		if (clients.length == 0)
			messages = []
		else {
			let sendingData = {
				type: 'message',
				message: `${ ws.name } saiu`,
				to: 'all'
			}

			messages.push(sendingData)

			let updateListCommand = {
				type: 'command',
				command: 'update_users_list',
				params: clients
			}

			Array.from(wss.clients).map(client => {
				client.send(JSON.stringify(sendingData))
				client.send(JSON.stringify(updateListCommand))
				// client.send(`R@zion$update_users_list$${ clients }`)
			})

			messages.map((message, index) => {
				if (message.from == ws.name && message.to != 'all') {
					if (!Array.from(wss.clients).find(client => client.name == message.to))
						messages.splice(index, 1)
				}
				if (message.to == ws.name && !Array.from(wss.clients).find(client => client.name == message.from))
					messages.splice(index, 1)
			})
		}
	}
}

function executeCode(data, ws) {
	switch (data.command) {
		case ('set_name'):
			if (Array.from(wss.clients).find(client => client.name == data.params)) {
				let sendingData = {
					type: 'error',
					error: 'Já tem alguém usando esse nome...'
				}
				ws.send(JSON.stringify(sendingData))
				ws.close()
			}
			else {
				ws.name = data.params
				let successData = {
					type: 'success',
					success: 'login'
				}
				ws.send(JSON.stringify(successData))
				console.log('Nome do novo cliente: ', ws.name)

				let clients = Array.from(wss.clients).map(client => {
					return client.name
				})

				let updateListCommand = {
					type: 'command',
					command: 'update_users_list',
					params: clients
				}

				let sendingData = {
					type: 'message',
					message: `${ ws.name } entrou`,
					to: 'all'
				}

				messages.push(sendingData)
				
				Array.from(wss.clients).map(client => {
					// client.send(`R@zion$update_users_list$${ clients }`)
					if(client.name!=ws.name)
						client.send(JSON.stringify(sendingData))
					client.send(JSON.stringify(updateListCommand))
				})
			}
			break
		case ('get-messages'):
			let res
			if (data.from == 'all') {
				res = messages.filter(message => message.to == 'all' || !message.from)
			}
			else {
				res = messages.filter(message =>
					(message.from == data.from && message.to == ws.name) ||
					(message.from == ws.name && message.to == data.from) ||
					(!message.from))
			}

			for (let i = 0; i < res.length; i++) {
				let sendingData = {
					type: 'message',
					from: res[i].from,
					to: res[i].to,
					message: res[i].message
				}
				ws.send(JSON.stringify(sendingData))
			}
			break
		case ('ping'):
			let pong = {
				type: 'command',
				command: 'pong'
			}
			ws.send(JSON.stringify(pong))
			break
	}
}