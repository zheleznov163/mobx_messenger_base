import { makeAutoObservable, runInAction } from "mobx"
import { InputHandler } from "utils"
import User from "core/user"
import Message from "./Message"

export default class MessageEditor {
	message: Message | null = null
	input = new InputHandler()

	constructor(public user: User) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setMessage(message: Message | null = null) {
		this.message = message
		if (message) {
			this.input.set(message.body)
		}
	}

	get isChange() {
		const { input, message } = this
		return message && message.body !== input.value
	}

	get isCanDeleteText() {
		const { input, message } = this
		return message?.attachments.length === 0 ? input.value !== "" : true
	}

	async edit() {
		const { message, user, input } = this
		if (message && user.info?._id === message.sender._id) {
			const { body } = message

			if (this.isChange && this.isCanDeleteText) {
				if (message.isLoading) {
					message.setBody(input.value)
					this.setMessage(null)
				} else if (!message.sending) {
					message.setBody(input.value)
					message.markSending(true)
					this.setMessage(null)

					try {
						const data = await Message.edit(this.user, message, input.value)
						runInAction(() => {
							message.update(data)
							message.markSending(false)
						})
					} catch (error: unknown) {
						runInAction(() => {
							message.setBody(body).markSending(false)
						})
						throw error
					}
				}
			}
		}
	}
}
