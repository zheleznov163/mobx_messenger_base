import { makeAutoObservable, reaction, runInAction } from "mobx"
import { IUser } from "core/user"
import { InputHandler } from "utils"
import Message from "./Message"
import { IConversation } from "../Chat/types"
import { ShortMessage } from "./types"

const LIMIT = 100

/**
 * Поисковик сообщений в чате
 */
export default class MessageSearch {
	input = new InputHandler()

	data: ShortMessage[] = []
	meta: { total?: number; count?: number } = {}
	total = 0
	loading = false

	constructor(public user: IUser, public chatInfo: IConversation) {
		makeAutoObservable(this, {}, { autoBind: true })
		reaction(() => this.input.value, this.debounceSearch)
	}

	token?: number
	debounceSearch = () => {
		clearTimeout(this.token)
		if (this.input.value) {
			this.loading = true
			// @ts-ignore
			this.token = setTimeout(async () => {
				await this.search()
				runInAction(() => {
					this.loading = false
				})
			}, 1000)
		} else {
			this.loading === false
		}
	}

	async search(page = 0) {
		if (this.isOpen) {
			try {
				const { data, meta } = await Message.search(
					this.user,
					this.input.value,
					LIMIT,
					page,
					this.chatInfo,
				)
				runInAction(() => {
					if (page > 0) {
						this.data.push(...data)
					} else {
						this.data = data
					}
					this.meta = meta
					this.index = this.data.length > 0 ? 0 : null
				})
			} catch (error: unknown) {
				throw error
			}
		}
	}

	// ------ Open -------------------
	isOpen: boolean = false
	open() {
		this.isOpen = true
	}

	close() {
		this.isOpen = false
	}

	// --------- set Active ------------
	index: number | null = null
	setIndex(index: number | null) {
		this.index = index
	}

	get active() {
		if (this.index !== null) {
			return this.data[this.index]
		}
		return undefined
	}

	get isCanNext() {
		return this.index !== null && this.index < this.data.length - 1
	}
	next = () => {
		if (this.isCanNext) {
			// @ts-ignore
			this.setIndex(this.index + 1)
		}
	}

	get isCanPrev() {
		return this.index !== null && this.index > 0
	}
	prev = () => {
		if (this.isCanPrev) {
			// @ts-ignore
			this.setIndex(this.index - 1)
		}
	}
}
