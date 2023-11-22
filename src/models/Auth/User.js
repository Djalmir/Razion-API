require('dotenv/config')
const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	},
	profilePicture: {
		type: String,
		required: false
	},
	phone: {
		type: String,
		required: false
	},
	birthDate: {
		type: Date,
		required: false
	},
	sex: {
		type: String,
		required: false
	}
}, {
	toJSON: {
		virtuals: true
	}
})

UserSchema.virtual('profilePictureUrl').get(function () {
	return this.profilePicture ? `${ process.env.BASE_URL }/files/${ this.profilePicture }` : null
})

module.exports = mongoose.model('User', UserSchema)