import { makeAutoObservable } from "mobx"
import Api from "core/api"
import { IUser } from "core/user"
import { IEmotion, IMessage } from "./types"

export default class Emotion implements IEmotion {
	private _users: Set<string>
	emotion: IEmotion["emotion"]

	constructor(data: IEmotion) {
		this._users = new Set(data.users)
		this.emotion = data.emotion
		makeAutoObservable(this)
	}

	get users(): IEmotion["users"] {
		return [...this._users]
	}

	has(userID: string) {
		return this._users.has(userID)
	}
	delete(userID: string) {
		this._users.delete(userID)
		return this
	}
	add(userID: string) {
		this._users.add(userID)
		return this
	}
	toggle(userID: string) {
		return this.has(userID) ? this.delete(userID) : this.add(userID)
	}

	get isEmpty() {
		return this._users.size === 0
	}

	toJSON(): IEmotion {
		const { emotion, users } = this
		return { emotion, users }
	}

	static aliases = {
		"👍": { sort: 0, link: "" },
		"❤️": { sort: 1, link: "" },
		"😊": { sort: 2, link: "" },
		"😀": { sort: 2, link: "" },
		"😆": { sort: 3, link: "" },
		"😜": { sort: 3, link: "" },
		"😢": { sort: 4, link: "" },
		"😮": { sort: 5, link: "" },
		"😡": { sort: 6, link: "" },
	}

	static byAliases = (e1: Emotion, e2: Emotion) =>
		Emotion.aliases[e1.emotion].sort - Emotion.aliases[e2.emotion].sort

	static listBy = (emotions?: IEmotion[]) =>
		(emotions || []).map((data) => new Emotion(data)).sort(Emotion.byAliases)

	static hasID = (userID: string) => (e: Emotion) => e.has(userID)
	static byEmoji = (emoji: IEmotion["emotion"]) => (e: Emotion) => e.emotion === emoji

	// TODO: Зачем?
	static async get(user: IUser) {
		type Result = {
			body: { result: { data: { _id: string }[] } }
		}
		const res = await Api.fetch<Result>("api/messages/emotions", {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
		return res.body.result.data.map((reaction: { _id: string }) => ({ id: reaction._id }))
	}

	static async set(user: IUser, message: Pick<IMessage, "_id">, emotionId: string) {
		await Api.fetch("api/messages/emotions", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				messageId: message._id,
				emotionId,
			}),
		})
	}
}
