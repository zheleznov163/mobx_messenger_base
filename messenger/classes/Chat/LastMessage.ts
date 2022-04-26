import moment from "moment"
import { IUserInfo } from "core/user"
import { IConversation } from "./types"
import { IMessage, ILastMessage } from "../Message/types"

/**
 * Логика представления данных IConversation['lastMessage']
 */
export default class LastMessage {
	constructor(readonly info: ILastMessage) {}

	getAuthorName(user: IUserInfo, type: IConversation["type"]) {
		const { sender } = this.info
		if (sender._id === user._id) {
			return "Вы: "
		}
		return type === "chat" ? `${sender.username}: ` : ""
	}

	get text() {
		const { attachmentType, forwardedMessage, body } = this.info
		if (attachmentType) {
			return `${this.icon} ${this.type}`
		}
		if (forwardedMessage) {
			return body ? "↩️ Ответ" : "↪️ Пересланное сообщение"
		}
		return body || ""
	}

	get date() {
		const date = moment(this.info.createdAt)
		if (date.isSame(moment(), "day")) {
			return date.format("HH:mm")
		}
		if (date.isSame(moment().subtract(1, "day"), "day")) {
			return "вчера"
		}
		return date.format("D MMM")
	}

	private get icon() {
		switch (this.info.attachmentType) {
			case "video":
				return "📹"
			case "photo":
				return "📷"
			case "file":
				return "📎"
			default:
		}
	}

	private get type() {
		switch (this.info.attachmentType) {
			case "video":
				return "Видео"
			case "photo":
				return "Фото"
			case "file":
				return "Файл"
			default:
		}
	}

	// TODO:  Убрать этот костыль
	static parse({
		_id,
		attachments,
		body,
		createdAt,
		sender,
		forwardedMessage,
	}: Pick<
		IMessage,
		"_id" | "attachments" | "body" | "createdAt" | "sender" | "forwardedMessage"
	>): ILastMessage {
		let attachmentType: ILastMessage["attachmentType"] = null

		const attach = attachments[0]
		if (attach) {
			switch (attach.type) {
				case "image":
					attachmentType = "photo"
					break
				case "file":
				case "video":
					attachmentType = attach.type
					break
				case "audio":
				default:
					break
			}
		}
		return {
			_id,
			body,
			createdAt,
			sender,
			forwardedMessage: forwardedMessage ? LastMessage.parse(forwardedMessage) : undefined,
			attachmentType,
		}
	}
}
