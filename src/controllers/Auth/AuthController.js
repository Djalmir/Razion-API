const express = require('express')
const router = express.Router()
const User = require('../../models/Auth/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const uploadConfig = require('../../config/upload')
const upload = multer(uploadConfig)

function generateToken(params = {}) {
	return jwt.sign(params, process.env.TOKEN_SECRET, { expiresIn: 604800/* 7 dias */, })
}

function verifyJWT(req, res, next) {
	const token = req.headers['authorization']
	if (!token)
		return res.status(401).send({ auth: false, error: 'Nenhum token informado.' })
	jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
		if (err)
			return res.status(400).send({ auth: false, error: 'Token inválido.' })
		req.headers.user_id = decoded._id
		next()
	})
}

router.post('/signup', async (req, res) => {
	if (!req.body.name)
		return res.status(400).json({ field: 'name', error: 'Nome obrigatório' })
	if (!req.body.email)
		return res.status(400).json({ field: 'email', error: 'Email obrigatório' })
	if (!req.body.password)
		return res.status(400).json({ field: 'password', error: 'Senha obrigatória' })

	let name = req.body.name.toLowerCase()
	name = name.split(' ')
	name.map((n, index) => {
		name[index] = n.charAt(0).toUpperCase() + n.slice(1)
	})
	name = name.join(' ')
	let email = req.body.email.toLowerCase()
	let password = req.body.password
	if (password.length < 3)
		return res.status(400).json({ field: 'password', error: 'A senha deve ter pelo menos 3 caracteres.' })
	bcrypt.hash(password, 10, async function (err, hash) {
		if (hash) {
			password = hash
			let user = await User.findOne({ email: email })
			if (!user) {
				user = await User.create({
					name,
					email,
					password
				})
				let token = generateToken({ _id: user._id, name: user.name, email: user.email })
				return res.json({
					_id: user._id,
					name,
					email,
					token
				})
			}
			return res.status(400).json({ field: 'email', error: 'Já existe um usuário cadastrado com este email.' })
		}
		else
			return res.status(400).json({ error: err })
	})
})

router.post('/login', async (req, res) => {
	let { email, password } = req.body

	const foundUser = await User.findOne({ email: email.toLowerCase() })
	if (!foundUser)
		return res.status(400).json({ field: "email", error: "Usuário inválido" })

	if (!await bcrypt.compare(password, foundUser.password))
		return res.status(400).json({ field: "password", error: "Senha inválida" })

	const user = {
		_id: foundUser._id,
		name: foundUser.name,
		email: foundUser.email,
		profilePicture: `${ process.env.BASE_URL }files/${ foundUser.profilePicture }`,
		phone: foundUser.phone,
		birthDate: foundUser.birthDate,
		sex: foundUser.sex
	}

	return res.json({
		...user,
		token: generateToken({ _id: foundUser._id, name: foundUser.name, email: foundUser.email })
	})
})

router.get('/profile', verifyJWT, async (req, res) => {
	const { user_id } = req.headers
	const foundUser = await User.findById(user_id)

	if (!foundUser)
		return res.status(400).json({ error: 'Usuário invलlido' })

	return res.json({
		_id: foundUser._id,
		name: foundUser.name,
		email: foundUser.email,
		profilePicture: `${ process.env.BASE_URL }files/${ foundUser.profilePicture }`,
		phone: foundUser.phone,
		birthDate: foundUser.birthDate,
		sex: foundUser.sex
	})
})

router.put('/updateProfile', verifyJWT, upload.single('profilePicture'), async (req, res) => {
	const { user_id } = req.headers

	const foundUser = await User.findById(user_id)
	if (!foundUser)
		return res.status(400).json({ error: 'Usuário inválido' })

	let name = req.body.name?.toLowerCase()
	if (name) {
		name = name.split(' ')
		name.map((n, index) => {
			name[index] = n.charAt(0).toUpperCase() + n.slice(1)
		})
		name = name.join(' ')
	}
	else
		name = foundUser.name
	const email = req.body.email?.toLowerCase() || foundUser.email
	let password

	if (req.body.password)
		password = req.body.password

	const phone = req.body.phone || foundUser.phone
	const birthDate = req.body.birthDate || foundUser.birthDate
	const sex = req.body.sex || foundUser.sex
	const profilePicture = req.file?.filename || foundUser.profilePicture
	if (req.file && foundUser.profilePicture) {
		try {
			const dir = path.resolve(__dirname, '..', '..', '..', 'uploads')
			fs.unlinkSync(`${ dir }/${ foundUser.profilePicture }`)
		}
		catch (err) {
			console.log(err)
		}
	}

	if (password) {
		if (!await bcrypt.compare(password, foundUser.password))
			return res.status(400).json({ field: "password", error: "Senha inválida" })
		let newPassword = req.body.newPassword
		if (newPassword.length < 3)
			return res.status(400).json({ field: 'newPassword', error: 'A senha deve ter pelo menos 3 caracteres' })

		bcrypt.hash(newPassword, 10, async function (err, hash) {
			if (hash) {
				newPassword = hash
				let user = await User.findOne({ email: email, _id: { $ne: user_id } })
				if (!user) {
					try {
						const user = await User.findByIdAndUpdate({ _id: user_id }, {
							name,
							email,
							password: newPassword,
							profilePicture,
							phone,
							birthDate,
							sex
						}, {
							new: true,
							useFindAndModify: false
						})
						return res.json({
							_id: user._id,
							name: user.name,
							email: user.email,
							profilePicture: `${ process.env.BASE_URL }files/${ user.profilePicture }`,
							phone: user.phone,
							birthDate: user.birthDate,
							sex: user.sex
						})
					}
					catch (err) {
						return res.status(400).send(err)
					}
				}
				return res.status(400).json({ error: "Já existe um usuário cadastrado com este email." })
			}
			else
				return res.status(400).send(err)
		})
	}
	else {
		let user = await User.findOne({ email: email, _id: { $ne: user_id } })
		if (!user) {
			try {
				const user = await User.findByIdAndUpdate({ _id: user_id }, {
					name,
					email,
					profilePicture,
					phone,
					birthDate,
					sex
				}, {
					new: true,
					useFindAndModify: false
				})
				return res.json({
					_id: user._id,
					name: user.name,
					email: user.email,
					profilePicture: `${ process.env.BASE_URL }files/${ user.profilePicture }`,
					phone: user.phone,
					birthDate: user.birthDate,
					sex: user.sex
				})
			}
			catch (err) {
				return res.status(400).send(err)
			}
		}
		return res.status(400).json({ error: "Já existe um usuário cadastrado com este email." })
	}
})

//FINALIZAR ESSA ROTA ANTES DE BOTAR EM USO
router.delete('/deleteAccount/:password', verifyJWT, async (req, res) => {
	const { user_id } = req.headers

	const foundUser = await User.findById(user_id)
	if (!foundUser)
		return res.status(400).json({ error: 'Usuário inválido' })

	let { password } = req.params

	if (!password)
		return res.status(400).json({ error: 'Senha obrigatória' })

	if (!await bcrypt.compare(password, foundUser.password))
		return res.status(400).json({ error: "Senha inválida" })

	//DELETAR TODOS OS DADOS DESSE USUÁRIO, EM TODOS OS SITES/APPS DA RAZION (Inclusive todas as mídias que ele subiu)
	//(O FRONT DEVE ALERTAR SOBRE ISSO ANTES DE CHAMAR ESSA ROTA)
	try {
		const dir = path.resolve(__dirname, '..', '..', '..', 'uploads')
		fs.unlinkSync(`${ dir }/${ foundUser.profilePicture }`)
	}
	catch (err) {
		console.log('Erro ao tentar remover foto de perfil: ', err)
	}

	//DELETA USUÁRIO	
	await User.findByIdAndDelete(user_id)
	return res.send('Conta excluída com sucesso')
})

module.exports = app => app.use('/auth', router)