import { makeAutoObservable, runInAction } from "mobx"
import moment from "moment"
import Api from "core/api"
import Attachment, { IAttachment, Request } from "core/attachment"
import User, { IUser } from "core/user"
import { guid } from "utils"
import { IConversation } from "../Chat/types"
import {
	IEmotion,
	ISendMessageBody,
	ShortMessage,
	IMessage,
	MessageModel,
	IKeybaord,
} from "./types"
import SplitedAttachments from "./SplitedAttachments"
import Emotion from "./Emotion"

type InitData = Partial<IMessage> &
	Pick<IMessage, "_id" | "createdAt" | "sender" | "roomId" | "updatedAt">

export default class Message implements MessageModel {
	_id: string
	deleted: IMessage["deleted"]
	sender: IMessage["sender"]
	keyboard?: IKeybaord
	forwardedMessage?: Message
	type?: "system"
	mentions: { _id: string; username: string }[]
	createdAt: string
	editedAt: string | null
	emotions: Emotion[] = []
	body: string
	attachments: IMessage["attachments"] = []
	unread: IMessage["unread"]
	edited: boolean
	roomId: string
	updatedAt: IMessage["updatedAt"]
	urls: any[]

	sending: boolean = false
	error: unknown = false

	constructor(m: InitData) {
		// parcer
		this.deleted = !!m.deleted
		this.keyboard = m.keyboard
		this.sender = m.sender
		this.forwardedMessage = m.forwardedMessage ? new Message(m.forwardedMessage) : undefined
		this._id = m._id
		this.mentions = m.mentions || []
		this.body = m.body || ""
		this.createdAt = m.createdAt
		this.emotions = Emotion.listBy(m.emotions)
		this.attachments = m.attachments ? m.attachments : []
		this.type = m.type
		this.unread = m.unread
		this.edited = !!m.edited //
		this.roomId = m.roomId
		this.updatedAt = m.updatedAt
		this.editedAt = m.editedAt || null
		this.urls = m.urls || []
		makeAutoObservable(this, {}, { autoBind: true })
	}

	update(m: IMessage) {
		this.deleted = m.deleted
		this.keyboard = m.keyboard
		this.sender = m.sender
		this.forwardedMessage = m.forwardedMessage ? new Message(m.forwardedMessage) : undefined
		this._id = m._id
		this.mentions = m.mentions || []
		this.body = m.body
		this.createdAt = m.createdAt
		this.emotions = Emotion.listBy(m.emotions)
		this.attachments = m.attachments
		this.type = m.type
		this.unread = m.unread
		this.edited = m.edited
		this.roomId = m.roomId
		this.editedAt = m.editedAt || null
		this.updatedAt = m.updatedAt
		this.urls = m.urls
	}

	toJSON(): IMessage {
		return {
			deleted: this.deleted,
			// @ts-ignore
			keyboard: this.keyboard,
			sender: this.sender,
			forwardedMessage: this.forwardedMessage?.toJSON(),
			_id: this._id,
			mentions: this.mentions,
			body: this.body,
			createdAt: this.createdAt,
			emotions: this.emotions,
			attachments: this.attachments,
			type: this.type,
			unread: this.unread,
			edited: this.edited,
			roomId: this.roomId,
			editedAt: this.editedAt,
			updatedAt: this.updatedAt,
			urls: this.urls,
		}
	}

	get time() {
		return moment(this.createdAt)
	}

	get fromNow() {
		return User.formatDate(
			this.time,
			moment().diff(this.time, "year") > 0 ? "D MMM YYYY" : "D MMMM",
		)
	}

	get timestamp(): number {
		return this.time.valueOf()
	}
	get shortBody() {
		if (this.body) {
			return this.body.length > 45 ? `${this.body.substring(0, 40)}...` : this.body
		}
	}
	get layoutType() {
		if (this.forwardedMessage && !this.body && !(this.attachments.length > 0)) {
			return "forward"
		} else {
			return "default"
		}
	}

	get isSticker(): boolean {
		if (this.layoutType === "default") {
			return this.attachments.length > 0 && this.attachments[0]?.type === "sticker"
		} else {
			if (this.forwardedMessage) {
				return (
					this.forwardedMessage?.attachments.length > 0 &&
					this.forwardedMessage.attachments[0].type === "sticker"
				)
			}
		}
		return false
	}

	get isAudio() {
		if (this.layoutType === "default") {
			return (
				(this.attachments.length > 0 && this.attachments[0]?.type === "audio") ||
				(this.uploads.length > 0 && this.uploads[0].file.type.includes("audio"))
			)
		} else {
			if (this.forwardedMessage) {
				return (
					this.forwardedMessage.attachments.length > 0 &&
					this.forwardedMessage.attachments[0].type === "audio"
				)
			}
		}
		return false
	}

	get bubbleType(): "system" | "default" | "sticker" | "audio" | "deleted" {
		return this.type === "system"
			? "system"
			: this.deleted
			? "deleted"
			: this.isSticker
			? "sticker"
			: this.isAudio
			? "audio"
			: //
			  "default"
	}

	get isCheckable() {
		return ["sticker", "default", "audio"].includes(this.bubbleType)
	}
	get splitedAttachs() {
		return SplitedAttachments.createBy(this.attachments)
	}

	setBody(body: string) {
		this.body = body
		return this
	}

	setReaded() {
		this.unread = false
	}
	setDeleted() {
		this.deleted = true
		this.body = "Сообщение удалено"
	}

	// ----------------------- Реакции ----------------------------

	toggleReactions(userID: string, emotion: IEmotion["emotion"]) {
		const currentIndex = this.emotions.findIndex(Emotion.hasID(userID))
		const targetIndex = this.emotions.findIndex(Emotion.byEmoji(emotion))

		const target = targetIndex !== -1 ? this.emotions[targetIndex] : undefined
		const current = currentIndex !== -1 ? this.emotions[currentIndex] : undefined

		// Осторожно использовать remove, так как меняет индексацию для this.emotions
		const remove = (index: number) => this.emotions.splice(index, 1)
		const add = () => this.emotions.push(new Emotion({ emotion, users: [userID] }))

		if (target && current && target === current) {
			target?.delete(userID).isEmpty && remove(targetIndex)
		} else {
			current?.delete(userID)
			target ? target.toggle(userID) : add()

			// Удаляем пустые
			if (current?.isEmpty) {
				remove(currentIndex)
			} else if (target?.isEmpty) {
				remove(targetIndex)
			}
		}
	}

	async setReation(user: IUser, emotion: IEmotion["emotion"]) {
		await Emotion.set(user, this, emotion)
	}

	// ----------------------------

	setID(id: string) {
		this._id = id
	}

	markSending(value: boolean) {
		this.sending = value
		return this
	}
	markError(error: unknown) {
		this.error = error
		return this
	}

	/** Возвращает новое сообщение, которое содержит полезный контент */
	asForward(): Message {
		if (this.layoutType === "forward" && this.forwardedMessage) {
			return this.forwardedMessage
		}
		return new Message({ ...this, forwardedMessage: undefined })
	}

	setForward(message?: Message): this {
		this.forwardedMessage = message
		return this
	}

	setAttachment(attahcments: IAttachment[]) {
		this.attachments = attahcments
		return this
	}

	// ---------- Предзагрузка Вложений ------------

	uploads: Request[] = []
	isLoading = false

	setUploads(uploads: Request[]) {
		this.uploads = uploads
		return this
	}

	stopUploads() {
		this.uploads.forEach(Attachment.Request.stop)
	}

	/**
	 * Последовательная загрузка,
	 * параллельная работает с ошибками
	 */
	async startLoads() {
		const attachments: IAttachment[] = []
		for (const upload of this.uploads) {
			attachments.push(upload.attachment || (await upload.start()))
		}
		return attachments
	}

	async startUploads() {
		if (this.uploads.length > 0) {
			this.isLoading = true
			try {
				this.stopUploads()
				const attachments = await this.startLoads()
				runInAction(() => {
					this.uploads = []
					this.attachments = attachments
					this.isLoading = false
				})
			} catch (error: unknown) {
				runInAction(() => {
					this.isLoading = false
					this.markError(error)
				})
				throw error
			}
		}
	}
	//---------------- Фабрики ----------------------------
	static create(
		sender: IMessage["sender"],
		roomId: string,
		body: string,
		attachments: IAttachment[] = [],
		forwardedMessage?: IMessage,
	) {
		const createdAt = new Date().toISOString()
		return new Message({
			_id: guid(),
			sender,
			roomId,
			body,
			attachments,
			forwardedMessage,
			createdAt,
			updatedAt: createdAt,

			type: undefined,
			deleted: false,
			edited: false,
			unread: true,

			keyboard: { buttons: [], hide: false, oneTime: false },
			mentions: [],
			urls: [],
		})
	}
	static listBy(messages: IMessage[]) {
		return messages.map((message) => new Message(message))
	}

	// -------------- Костыли для сравнения отправленного сообщения и сокета --------

	/** Проверка идентичности вложений */
	static compareAttachment(m1: Message, m2: Message) {
		let result = true

		/** Не идентично */
		const checkeEqAttach = (index1: number, index2: number, id1: string, id2: string) => {
			if (index1 === index2 && id1 !== id2) {
				result = false
			}
		}
		const checkEqIDs = () =>
			m1.attachments.forEach((attach1, index1) =>
				m2.attachments.forEach((attach2, index2) =>
					checkeEqAttach(index1, index2, attach1._id, attach2._id),
				),
			)

		// Совпала длинна
		if (m1.attachments.length === m2.attachments.length) {
			checkEqIDs()
		} else {
			result = false
		}
		return result
	}

	static compareBody(m1: Message, m2: Message) {
		return (!m1.body && !m2.body) || m1.body === m2.body
	}
	static compareSender(m1: Message, m2: Message) {
		return m1.sender._id === m2.sender._id
	}
	static compareForwarded(m1: Message, m2: Message) {
		return m1.forwardedMessage?._id === m2.forwardedMessage?._id
	}

	// -------------------------------

	static sortByCreatedAt = (m1: Message, m2: Message) => m1.time.diff(m2.time)
	static byId =
		(id: string) =>
		({ _id }: Message) =>
			_id === id
	static equal =
		(m1: Message, flag = true) =>
		(m2: Message) =>
			(m1 !== m2) === flag
	static bySenderID =
		(senderID: string, flag = true) =>
		({ sender }: Message) =>
			(sender._id === senderID) === flag
	// ------------ API -------------------

	static async send(
		user: IUser,
		room: IConversation,
		message: Pick<Message, "body" | "attachments" | "forwardedMessage">,
		forwardedMessages?: Message[] | null,
	) {
		const body: ISendMessageBody = {
			roomId: room._id,
			body: message.body,
			attachmentIds: message.attachments?.map(({ _id }) => _id),
			forwardedMessageId: message.forwardedMessage?._id, // для ответа на сообщение
			forwardedMessageIds: forwardedMessages?.sort(Message.sortByCreatedAt).map(({ _id }) => _id),
		}
		const response = await Api.fetch<{ result: string }>("api/messages/send_message", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify(body),
		})

		return response.result
	}

	static async sendForwards(user: IUser, room: Pick<IConversation, "_id">, messages: Message[]) {
		const body: ISendMessageBody = {
			roomId: room._id,
			forwardedMessageIds: messages.map((message) => message.asForward()._id),
		}
		const response = await Api.fetch<{ result: string }>("api/messages/send_message", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify(body),
		})

		return response.result
	}

	static async edit(user: IUser, message: Pick<IMessage, "_id">, body: string) {
		type Result = { result: IMessage }

		const { result } = await Api.fetch<Result>("api/messages/edit_message", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				messageId: message._id,
				body,
			}),
		})
		return result
	}
	static async delete(user: IUser, message: Pick<IMessage, "_id">) {
		await Api.fetch("api/messages/delete_message", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				messageId: message._id,
			}),
		})
	}
	static async markReaded(user: IUser, roomId: string, timestamp: number) {
		await Api.fetch("api/messages/read_messages", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId,
				timestamp,
			}),
		})
	}
	static async search(user: IUser, query: string, limit: number, page = 1, room?: IConversation) {
		type ReasponseSearchMessages = {
			data: ShortMessage[]
			meta: { total?: number; count?: number }
		}
		const search = `?query=${query}&limit=${limit}&page=${page}${room ? `&roomId=${room._id}` : ""}`
		return Api.fetch<ReasponseSearchMessages>(`api/messages/search${search}`, {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
	}
}
