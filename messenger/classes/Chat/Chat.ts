import { makeAutoObservable, runInAction } from "mobx"
import User, { IPerson } from "../../../core/user";
import Attachment, {
	IDocument,
  IAttachment,
  FileIDocument,
} from "../../../core/attachment";
import { getDeclension, List } from "utils"
import { IConversation } from "./types"
import Message, { MessageEditor, MessageSearch, IEmotion, IMessage } from "../Message"
import LastMessage from "./LastMessage"
import MembersColor from "./MembersColor"
import MessageFinder from "./MessageFinder"
import ChatApi from "./ChatApi"
import MessageLink from "./MessagesChain/MessageLink"
import ChatSettings from "./ChatSettings"
import ReactionsMenu from "./ReactionsMenu"
import ChatEditor from "./ChatEditor"
import PinMessage from "./PinMessage"
import ChatMessages from "./ChatMessages"

export const MAX_MESSAGE_LENGTH = 2048

export default class Chat {
	static Api = ChatApi
	/** Цитируемое сообщение */
	quote: Message | null = null
	/** Пересылаемые */
	forwarded: Message[] | null = null

	// /** Закрепленное сообщение */
	// pinMessage: Message | null = null

	/** список выбранн */
	selected = new Set<Message>()

	prepareText = ""
	prepareFiles = new List<IDocument | FileIDocument>()

	loadings = {
		resend: false,
		pushing: false,
	}

	// moreAfter?: boolean
	// moreBefore?: boolean

	/** Поисковик сообщений на беке */
	search = new MessageSearch(this.user, this.info)
	/** Поисковик сообщений в собственной цепочке */
	settings = new ChatSettings(this.info, this.user)
	/** Редактирование чата */
	editor = new ChatEditor(this)
	/** Вычисление цвета для отображения в групповом чате */
	memberColor = new MembersColor(this.info)
	// /** Цепочка сообщений */
	// messagesChain = new MessagesChain(this)

	pin = new PinMessage(this.info, this.user)
	messages = new ChatMessages(this)
	finder = new MessageFinder(this.messages)

	/** Меню реакций сообщений */
	reactions = new ReactionsMenu(this)
	/**	Редактор сообщений */
	messageEditor = new MessageEditor(this.user)

	constructor(public info: IConversation, public user: User) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get id() {
		return this.info._id
	}
	get type() {
		return this.info.type
	}

	get member() {
		const { info, user } = this
		if (info.type === "dialog") {
			return info.members.find(({ _id }) => _id !== user.info?._id)
		}
	}

	get isSaved() {
		return this.info.type === "dialog" && !this.member
	}

	get isSelectMode() {
		return this.selected.size !== 0
	}

	get selectedIDs() {
		return [...this.selected].map(({ _id }) => _id)
	}

	get title() {
		switch (this.info.type) {
			case "dialog":
				if (this.member && (this.member.firstName || this.member.lastName)) {
					return `${this.member.firstName} ${this.member.lastName}`.trim()
				}
				return this.member?.username || "Избранное"
			case "chat":
				return this.info.name
			default:
				return ""
		}
	}

	get subtitle() {
		switch (this.info.type) {
			case "dialog":
				return (this.member && this.member.status) || "offline"
			case "chat":
				const total = this.info.members.length
				const online = this.info.members.filter(User.isOnline).length
				if (total) {
					return `${total} ${getDeclension(total, [
						"участник",
						"участника",
						"участников",
					])}, ${online} в сети`
				} else {
					return ""
				}
			default:
				return ""
		}
	}

	get photo() {
		return this.info.photo
	}

	get status() {
		switch (this.info.type) {
			case "dialog":
				return (this.member && this.member.status) || "offline"
			case "chat":
			default:
				return "offline"
		}
	}

	get isHaveUnread() {
		return !!this.unread
	}

	get unread() {
		return !this.isSaved ? this.info.unread : 0
	}

	set unread(value: number) {
		this.info.unread = value
	}

	get avatar() {
		switch (this.info.type) {
			case "dialog":
				return this.member?.photo?.link
			case "chat":
				return this.info.photo?.preview
			default:
				break
		}
	}

	get keyboard() {
		const { chain } = this.messages
		if (chain.length > 0) {
			for (let i = 0; i < chain.length; i++) {
				const keyboard = chain[i].message.keyboard
				if (keyboard && keyboard.buttons.length > 0) {
					const { hide, oneTime, buttons } = keyboard
					if (hide || (oneTime && i !== 0)) {
						return undefined
					}
					return {
						messageID: chain[i].message._id,
						buttons,
					}
				}
			}
		}
		return undefined
	}

	toggleSelect(message: Message) {
		if (this.selectedIDs.includes(message._id)) {
			this.selected.delete(message)
		} else {
			this.selected.add(message)
		}
	}

	checkSelected({ _id }: Pick<Message, "_id">) {
		return this.selectedIDs.includes(_id)
	}

	setSelected(messages: Message[]) {
		this.selected = new Set(messages)
	}

	/** Обновить последнее сообщение */
	updateLastMessage(message: Message) {
		// @ts-ignore FAIL...
		this.info.lastMessage = LastMessage.parse(message)
	}

	/** Обновить время последнего просмотра */
	updateLastSeen(lastSeen: string) {
		this.info.lastSeen = lastSeen
	}

	/** Обновить сообщение */
	updateMessage(message: IMessage) {
		this.messages.chain
			//
			.find(MessageLink.byId(message._id))
			?.message.update(message)
	}

	/** Переключить реакцию  */
	toggleReactions(
		message: Pick<IMessage, "_id">,
		newEmo: { user: string; emotion: IEmotion["emotion"] },
	) {
		this.messages.chain
			//
			.find(MessageLink.byId(message._id))
			?.message.toggleReactions(newEmo.user, newEmo.emotion)
	}

	/** Добавить собственную реакцию   */
	addSelfReaction(message: Message, emoji: IEmotion["emotion"]) {
		message.setReation(this.user, emoji)
	}

	/** Отметить удаленным  */
	markDelete(deletedMessage: Pick<IMessage, "_id">) {
		this.messages.chain
			//
			.find(MessageLink.byId(deletedMessage._id))
			?.message.setDeleted()
	}

	/** Удалить сообщения */
	async deleteMessage(message: Pick<IMessage, "_id">) {
		this.messages.chain.find(MessageLink.byId(message._id))?.message.setDeleted()
		await Message.delete(this.user, message)
	}

	readFrom(user: Pick<IPerson, "_id">, lastSeen: string) {
		this.updateLastSeen(lastSeen)
		if (user._id !== this.user.info?._id) {
			this.messages.markReaded()
		} else {
			this.unread = 0
		}
	}

	/** Ввод текста для отправки  */
	setPrepareText(text: string) {
		this.prepareText = text
	}

	async sendMessage(message: Message) {
		const { user, info } = this

		message.markSending(true)
		const uploadFinish = message.startUploads() // => 📦
		this.messages.addHard(message)

		try {
			await uploadFinish
			const messageID = await Message.send(user, info, message) // => ✉️
			runInAction(() => {
				message.markSending(false)
				message.markError(false)
				message.setID(messageID) // уже может быть изменено по сокету
			})
		} catch (error: unknown) {
			message.markError(error)
		}
	}

	/** Отправить повторно  */
	async resend(link: MessageLink) {
		const { user, info, loadings } = this
		const { message } = link
		if (message.error && link.isSelf && !loadings.resend) {
			try {
				this.loadings.resend = true
				message.markError(false)

				await message.startUploads() // => 📦
				const messageID = await Message.send(user, info, message) // => ✉️

				runInAction(() => {
					this.loadings.resend = false
					message.markSending(false)
					message.markError(false)
					message.setID(messageID) // уже может быть изменено по сокету

					this.messages.remove(link)
					this.messages.addHard(message)
				})
			} catch (error: unknown) {
				runInAction(() => {
					this.loadings.resend = false
					message.markError(error)
				})
			}
		}
	}

	cancel(link: MessageLink) {
		const { message } = link
		if (message.isLoading) {
			message.stopUploads()
			this.messages.remove(link)
		}
	}

	delete(link: MessageLink) {
		const { message } = link
		if (message.error) {
			this.messages.remove(link)
		} else if (message.sending && message.isLoading) {
			message.stopUploads()
			this.messages.remove(link)
		} else {
			this.deleteMessage(message)
		}
		// приборка после удаления
		this.selected.delete(message)
		if (this.messageEditor.message === message) {
			this.messageEditor.setMessage(null)
		}

		if (this.quote === message) {
			this.delQuote()
		}
	}

	async sendForwarded() {
		const { info, user, forwarded } = this
		if (forwarded && user.info) {
			this.forwarded = null
			await this.sendNewMessage() // => ✉️ Отправляем обычное сообщение

			// run async functions one by one (in sequence)
			for (const message of forwarded.sort(Message.sortByCreatedAt)) {
				const createdMessage = this.createMessage()
					.setForward(message.asForward())
					.markSending(true)
				this.messages.addNext([createdMessage])

				try {
					const messageId = await Message.sendForwards(user, info, [message]) // => ✉️ [] Отправляем пересланные
					createdMessage.setID(messageId)
					runInAction(() => {
						createdMessage.markSending(false)
						createdMessage.markError(false)
					})
				} catch (error: unknown) {
					runInAction(() => {
						createdMessage.markSending(false)
						createdMessage.markError(true)
					})
				}
			}
		}
	}

	// Создать сообщение-пустышку на основе данных чата
	private createMessage() {
		const { info, user } = this
		return Message.create(user.info!, info._id, "")
	}

	/** Отправить подготовленное  */
	async sendNewMessage() {
		const {
			prepareText,
			prepareFiles: { items },
			quote,
		} = this
		const sendingText = prepareText.trim()
		if (sendingText || items.length > 0) {
			this.prepareText = ""
			this.prepareFiles.clear()
			this.quote = null
			await this.send(sendingText, items, quote) // => ✉️ []
		}
	}

	private createByFiles = (files: IDocument[] | File[]) =>
		Attachment.split<File | IDocument>(files, 10).map((files10) =>
			// @ts-ignore
			this.createMessage().setUploads(Attachment.Request.uploads(this.user, files10)),
		)
	private createByAttach = (attachments: IAttachment[]) =>
		Attachment.split(attachments, 10).map((attach10) =>
			this.createMessage().setAttachment(attach10),
		)

	/** Отправить вместе с предзагрузкой файлов и цитируемым */
	async send(text: string, files?: IDocument[] | File[], quote?: Message | null) {
		if (files && files.length > 0) {
			const messages = this.createByFiles(files)
			messages[0].setBody(text).setForward(quote?.asForward())
			await Promise.all(messages.map(this.sendMessage))
		} else {
			await this.sendMessage(this.createMessage().setBody(text).setForward(quote?.asForward()))
		}
	}

	/** отправить текст с атачами */
	async sendByAttach(attachments: IAttachment[]) {
		if (attachments && attachments.length > 0 && attachments.every((i) => !!i)) {
			const messages = this.createByAttach(attachments)
			messages.map(this.sendMessage)
		} else {
			const message = this.createMessage()
			this.sendMessage(message)
		}
	}

	// Установить список сообщений для пересылки
	setForwarded(messages: Message[] | null) {
		this.forwarded = messages
		if (messages) {
			this.delQuote()
		}
	}

	/** Выбрать для цитирования  */
	setQuote(message: Message) {
		this.forwarded = null
		this.quote = message
	}

	/** Удалить выбор для цитирования */
	delQuote() {
		this.quote = null
	}

	setInfo(info: IConversation) {
		this.info = info
	}

	/** Синхронизировать данные о чате */
	async updateInfo() {
		this.setInfo(await Chat.Api.getById(this.user, this.info._id))
	}

	async leave() {
		await Chat.Api.leave(this.user, this)
	}

	hideMenu() {
		const { search, finder, reactions } = this
		reactions.close()
		!search?.isOpen && finder?.remove()
	}

	ownersID = new Set<string>()
	checkOwner(member: Pick<IPerson, "_id">) {
		return this.ownersID.has(member._id)
	}
	/** Обновить список участников чата */
	async updateMembers() {
		const { owners, data } = await User.search(this.user, {
			page: 1,
			filters: {},
			query: "@",
			count: 5000,
			fromRoom: this.id,
		})
		runInAction(() => {
			this.ownersID = new Set(owners)
			this.info.members = data
		})
	}


	// callbacks 
	static byTitle =
		(searchText: string) =>
		({ title, member }: Chat) =>
			member?.username.toLowerCase().includes(searchText) ||
			title?.toLowerCase().includes(searchText)
	static byLastMessage = ({ info }: Chat) => !!info.lastMessage
	static byId =
		(id: string) =>
		({ info }: Chat) =>
			info._id === id
	static byIds =
		(ids: string[]) =>
		({ id }: Chat) =>
			ids.includes(id)
	static equal =
		(chat1: Chat, flag = true) =>
		(chat2: Chat) =>
			(chat1 === chat2) === flag
	static byUnread =
		(flag = true) =>
		({ isHaveUnread }: Chat) =>
			!!isHaveUnread === flag

	static create = (user: User) => (info: IConversation) => new Chat(info, user)

	static createFakeSaved(user: User) {
		return new Chat(
			{
				_id: "fake_saved",
				createdAt: new Date().toString(),
				lastSeen: new Date().toString(),
				linkInvite: false,
				members: [user.info!, user.info!],
				settings: {
					notifications: {
						enabled: true,
						sound: true,
						vibration: true,
					},
				},
				type: "dialog",
				unread: 0,
				updatedAt: new Date().toString(),
				isOwner: false,
			},
			user,
		)
	}
}
