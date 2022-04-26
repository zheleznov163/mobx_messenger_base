import { makeAutoObservable } from "mobx"
import Api from "core/api"
import User from "core/user"
import Message, { IMessage } from "../Message"
import { IConversation } from "./types"

export default class PinMessage {
	message: Message | null = null

	constructor(public chatInfo: IConversation, public user: User) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	set(message: Message | null) {
		this.message = message
	}
	/** Загрузить закрепленное сообщение */
	async get() {
		this.set(await PinMessage.get(this.user, this.chatInfo))
	}

	async add(message: Message) {
		try {
			await PinMessage.set(this.user, this.chatInfo, message)
			this.set(message)
		} catch (error: unknown) {
			throw error
		}
	}

	async delete() {
		try {
			await PinMessage.delete(this.user, this.chatInfo)
			this.set(null)
		} catch (error: unknown) {
			throw error
		}
	}

	// ----------- pin message ---------------------

	static async set(user: User, info: IConversation, message: Message) {
		await Api.fetch(`api/rooms/${info._id}/pin`, {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				messageId: message._id,
			}),
		})
	}
	static async delete(user: User, info: IConversation) {
		await Api.fetch(`api/rooms/${info._id}/pin`, {
			method: "DELETE",
			headers: { "x-access-token": user.token },
		})
	}
	static async get(user: User, info: IConversation) {
		const response = await Api.fetch<{ result: IMessage | null }>(`api/rooms/${info._id}/pin`, {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
		return response.result && new Message(response.result)
	}
}
