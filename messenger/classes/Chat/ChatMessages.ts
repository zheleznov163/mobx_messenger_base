import { makeAutoObservable, runInAction } from "mobx"
import Chat from "./Chat"
import MessagesChain, { MessageLink } from "./MessagesChain"
import Message, { IMessage } from "../Message"
import User from "core/user"
import Api from "core/api"
import moment from "moment"

export default class ChatMessages {
	private messagesChain: MessagesChain

	moreAfter: boolean = false
	moreBefore: boolean = false

	/** указатель на сообщение,  которого начинаеются новые сообщения*/
	new: MessageLink | null = null

	loadings = {
		get: false,
		prev: false,
		next: false,
	}

	constructor(public chat: Chat) {
		this.messagesChain = new MessagesChain(chat)
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get chain() {
		return this.messagesChain.chain
	}

	get last() {
		return this.messagesChain.last
	}

	get first() {
		return this.messagesChain.first
	}

	get raw() {
		return this.chain.map(({ message }) => message)
	}

	setNew(link: MessageLink | null = null) {
		if (link === null || (!this.new && !link.isSelf)) {
			this.new = link
		}
	}

	updateChain(messages: Message[]) {
		const IDs = this.chain.map(({ message }) => message._id)
		const links = this.messagesChain.update(messages)
		const newLinks = []

		for (const link of links) {
			if (!IDs.includes(link.message._id)) {
				newLinks.push(link)
			} else {
				break
			}
		}

		// Если нет новых сообщений на данный момент
		if (!this.new) {
			// то новыми станут начиная с последнего сообщения, у которых отправитель не я
			this.setNew(newLinks.reverse().find(MessageLink.isSelf(false)))
		} else {
			// иначе новым останется старый, но изменит ссылку на линк текущего списка
			this.setNew(links.find(MessageLink.byId(this.new.id)))
		}
	}

	/** Загрузить сообщения */
	async get() {
		if (!this.loadings.get) {
			this.loadings.get = true
			const { user, id, info } = this.chat
			try {
				const { messages, moreAfter, moreBefore } = await ChatMessages.getSurrounding(
					user,
					id,
					moment(info.lastSeen).valueOf(),
					40,
				)
				runInAction(() => {
					this.moreAfter = moreAfter
					this.moreBefore = moreBefore
					this.updateChain(messages)
					this.loadings.get = false
				})
			} catch (error: unknown) {
				runInAction(() => {
					this.loadings.get = false
				})
				throw error
			}
		}

		return this.chat
	}

	/**
	 * Поиск сообщения, которое не требует добавления в ленту
	 */
	private check(newMessage: Message) {
		const { chain } = this

		if (newMessage.layoutType === "forward") {
			for (let link of chain) {
				const { message } = link
				if (Message.compareForwarded(message, newMessage)) {
					message.markError(false)
					message.markSending(false)
					message.setID(newMessage._id)
					return false
				}
			}
		} else {
			for (let link of chain) {
				const { message } = link
				if (message._id === newMessage._id) {
					return false
				}
				if (
					message.sending &&
					Message.compareBody(message, newMessage) &&
					Message.compareAttachment(message, newMessage) &&
					Message.compareSender(message, newMessage)
				) {
					message.markError(false)
					message.markSending(false)
					message.setID(newMessage._id)
					return false
				}
			}
		}

		return true
	}

	// получение Сообщения от внешнего источника (ex. Socket)
	add(message: Message) {
		if (!this.moreAfter) {
			if (this.check(message)) {
				this.setNew(this.messagesChain.add(message))
				return true
			}
		} else {
			this.setNew(new MessageLink(this.messagesChain, message))
		}
		return false
	}

	// TODO: возможно лучше наследоваться от MessagesChain
	addHard(message: Message) {
		this.setNew(this.messagesChain.add(message))
	}

	addNext(messages: Message[]) {
		this.messagesChain.addNextMessages(messages)
	}

	remove(link: MessageLink) {
		this.messagesChain.delete(link)
	}

	init(messages: Message[]) {
		this.messagesChain.init(messages)
	}

	async surround(timestamp: number) {
		const { user, id } = this.chat
		const { messages, moreAfter, moreBefore } = await ChatMessages.getSurrounding(
			user,
			id,
			timestamp,
			20,
		)
		runInAction(() => {
			this.moreAfter = moreAfter
			this.moreBefore = moreBefore
			this.messagesChain.init(messages)
		})
	}

	read() {
		if (!this.moreAfter) {
			const last = this.chain.find(({ message }) => !message.sending && !message.error)
			if (last) {
				Message.markReaded(this.chat.user, this.chat.id, last.message.timestamp)
			}
		}
	}

	markReaded() {
		this.chain.forEach((link) => link.isSelf && link.message.setReaded())
	}

	/** Загрузить предыдущие сообщения */
	async prev() {
		const { chat, messagesChain, loadings, moreBefore } = this
		if (!loadings.prev && moreBefore && messagesChain.first) {
			const { user, id } = chat
			this.loadings.prev = true

			const { messages } = await ChatMessages.getPrevious(
				user,
				id,
				messagesChain.first.message.timestamp,
				20,
			)

			runInAction(() => {
				this.moreBefore = messages.length > 0
				this.messagesChain.addPrevMessages(messages)
				this.loadings.prev = false
			})
		}
	}

	/** Загрузить следующие сообщения */
	async next() {
		const { chat, messagesChain, loadings, moreAfter } = this

		if (!loadings.next && moreAfter && messagesChain.last) {
			this.loadings.next = true
			const { user, id } = chat

			const messages = await ChatMessages.getNext(
				user,
				id,
				messagesChain.last.message.timestamp,
				20,
			)
			messages.shift() // одно сообщение надо удалить, приходит внахлест
			messages.reverse() // не знаю почему, но в этой ручке порядок обратный

			runInAction(() => {
				this.moreAfter = !!messages.length
				this.messagesChain.addNextMessages(messages)
				this.loadings.next = false
			})
		}
	}

	// ------------------- Api -----------------------------------

	static async getPrevious(user: User, roomId: string, timestamp: number, limit: number) {
		type GetPreviousResponse = {
			lastSeen: string
			unreadNotLoaded: number
			messages: IMessage[]
		}

		const loadPrevious = `?roomId=${roomId}&timestamp=${timestamp}&limit=${limit}&deleted=${true}`
		const response = await Api.fetch<{ result: GetPreviousResponse }>(
			`api/messages/load_previous${loadPrevious}`,
			{
				method: "GET",
				headers: { "x-access-token": user.token },
			},
		)
		const { lastSeen, messages, unreadNotLoaded } = response.result
		return {
			lastSeen,
			unreadNotLoaded,
			messages: Message.listBy(messages),
		}
	}

	static async getNext(user: User, roomId: string, timestamp: number, limit: number) {
		const loadNext = `?roomId=${roomId}&timestamp=${timestamp}&limit=${limit}&deleted=${true}`
		const response = await Api.fetch<{ result: { messages: IMessage[] } }>(
			`api/messages/load_next${loadNext}`,
			{
				method: "GET",
				headers: { "x-access-token": user.token },
			},
		)
		return Message.listBy(response.result.messages)
	}

	static async getSurrounding(user: User, roomId: string, timestamp: number, limit: number) {
		const loadSurrounding = `?roomId=${roomId}&timestamp=${timestamp}&limit=${limit}&deleted=${true}`
		const response = await Api.fetch<GetMessagesResponse>(
			`api/messages/load_surrounding${loadSurrounding}`,
			{
				method: "GET",
				headers: { "x-access-token": user.token },
			},
		)
		const { messages, moreAfter, moreBefore } = response.result
		return {
			moreAfter,
			moreBefore,
			messages: Message.listBy(messages),
		}
	}
}

type GetMessagesResponse = {
	result: {
		messages: IMessage[]
		moreBefore: boolean
		moreAfter: boolean
	}
}
