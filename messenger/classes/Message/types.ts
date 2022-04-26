import { IPerson } from "core/user"
import { IAttachment } from "core/attachment"

export type IKeybaord = {
	oneTime: boolean
	hide: boolean
	buttons: { _id: string; text: string }[]
}

export interface IEmotion {
	users: string[]
	emotion: "👍" | "❤️" | "😊" | "😀" | "😆" | "😜" | "😢" | "😮" | "😡"
}

export interface IMessage {
	deleted: boolean
	type?: "system"
	_id: string
	attachments: IAttachment[]
	body: string
	forwardedMessage?: IMessage | null
	keyboard: IKeybaord
	createdAt: string
	edited: boolean
	mentions: { _id: string; username: string }[]
	roomId: string
	sender: Pick<IPerson, "_id" | "username">
	updatedAt: string
	editedAt: string | null
	urls: any[]
	unread?: boolean
	emotions?: IEmotion[]
}

export type ILastMessage = Pick<IMessage, "_id" | "body" | "createdAt" | "sender"> & {
	attachmentType: "file" | "photo" | "video" | "sticker" | null
	forwardedMessage?: ILastMessage
}

export type MessageModel = Omit<IMessage, "forwardedMessage" | "keyboard"> & {
	forwardedMessage?: MessageModel
	keyboard?: IKeybaord
}

export interface ISendMessageBody {
	roomId: string
	body?: string
	attachmentId?: string
	attachmentIds?: string[]
	forwardedMessageId?: string
	forwardedMessageIds?: string[]
}

export interface ShortMessage {
	_id: string
	roomId: string
	sender: Pick<IPerson, "_id" | "username">
	body: string
	forwardedMessage?: {
		sender: Pick<IPerson, "_id" | "username">
		body: string
		createdAt: string
	}
	createdAt: string
}
