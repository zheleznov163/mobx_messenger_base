import Api from "core/api"
import { IAttachment } from "core/attachment"
import User, { IPerson } from "core/user"
import Chat from "./Chat"

export default class ChatEditor {
	get isOwner() {
		return this.chat.checkOwner(this.chat.user.info!)
	}

	constructor(public chat: Chat) {}

	get user() {
		return this.chat.user
	}

	/** Разжаловать администратора */
	async removeOwner(member: Pick<IPerson, "_id">) {
		const { chat, user } = this
		await ChatEditor.removeOwner(user, chat, member)
		await chat.updateMembers()
	}

	/** Сделать участника администратором */
	async addOwner(member: Pick<IPerson, "_id">) {
		const { chat, user } = this
		await ChatEditor.addOwner(user, chat, member)
		await chat.updateMembers()
	}

	/** Удалить участника из чата */
	async kick(member: Pick<IPerson, "_id">) {
		const { chat, user } = this
		await ChatEditor.kick(user, chat, member)
		await chat.updateMembers()
	}

	/** Добавить участника в чат */
	async invite(members: Pick<IPerson, "_id">[]) {
		const { chat, user } = this
		await ChatEditor.invite(user, chat, members).catch(() => {})
		await chat.updateMembers()
	}

	async change(name: string, attachment?: IAttachment) {
		const { chat, user } = this
		await ChatEditor.update(user, chat, name, attachment)
		await chat.updateInfo()
	}

	// ----------- Owner ---------------------

	static async addOwner(user: User, chat: Chat, person: Pick<IPerson, "_id">) {
		return Api.fetch("api/rooms/add_owner", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId: chat.info._id,
				userId: person._id,
			}),
		})
	}
	static async removeOwner(user: User, chat: Chat, person: Pick<IPerson, "_id">) {
		return Api.fetch("api/rooms/remove_owner", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId: chat.info._id,
				userId: person._id,
			}),
		})
	}

	/**
	 * Добавляет одного или нескольких пользователей в комнату
	 */
	static async invite(user: User, chat: Chat, persons: Pick<IPerson, "_id">[]) {
		await Api.fetch("api/rooms/v1/invite", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId: chat.info._id,
				userIds: persons.map(({ _id }) => _id),
			}),
		})
	}
	static async kick(user: User, chat: Chat, member: Pick<IPerson, "_id">) {
		return Api.fetch("api/rooms/kick", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId: chat.info._id,
				userId: member._id,
			}),
		})
	}

	/** Обновить данные чата */
	static async update(user: User, chat: Chat, newChatName: string, attachment?: IAttachment) {
		await Api.fetch("api/rooms/update", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId: chat.info._id,
				name: newChatName,
				photoAttachment: attachment?._id,
			}),
		})
	}
}
