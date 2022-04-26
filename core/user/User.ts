import { makeAutoObservable } from "mobx"
import moment from "moment"
import Api from "../api"
import { IAttachment } from "../attachment"
import { IUserInfo, SearchUsersValues, UserBySearch, IUser, IPerson } from "./types"

export default class User implements IUser {
	constructor(public token: string, public info?: IUserInfo | null) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/** Загрузить данные пользователя */
	async sync() {
		const info = await User.getPersonalInfo(this.token)
		info.timezone = new Date().getTimezoneOffset() / -60
		User.setInfo(this, info)
		this.setInfo(info)
	}

	toJSON() {
		return {
			token: this.token,
			info: this.info || null,
		}
	}

	/** Объект пользователя больше не пригоден */
	logout() {
		this.token = ""
		this.info = null
	}

	setInfo(info: IUserInfo) {
		this.info = info
	}

	static byId =
		(id: string) =>
		({ _id }: Pick<IPerson, "_id">) =>
			_id === id

	// --------- Utils --------------

	static getFullName(person?: Partial<IPerson>) {
		if (person) {
			const { lastName, firstName, username } = person
			if (lastName || firstName) {
				return `${firstName} ${lastName}`.trim()
			}
			return username === "adapt_bot" ? "Василиса" : person.username
		}
	}

	static formatDate(date: moment.Moment, format = "D MMM YYYY") {
		if (date.isSame(new Date(), "day")) {
			return "Сегодня"
		}
		if (date.isSame(moment().subtract(1, "day"), "day")) {
			return "Вчера"
		}
		if (date.isSame(moment().subtract(2, "day"), "day")) {
			return "Позавчера"
		}
		return date.format(format)
	}

	static getLastActive(person: Partial<Pick<UserBySearch, "lastActivity" | "status">>) {
		const { status, lastActivity } = person
		if (status === "online") {
			return "В сети"
		}
		if (!lastActivity) {
			return "Не в сети"
		} else {
			return `Был(-а) ${User.formatDate(moment(lastActivity)).toLowerCase()}`
		}
	}

	static isOnline = ({ status }: Pick<IPerson, "status">) => status === "online"

	// -------- Api ------------

	static async getPersonalInfo(token: string) {
		return Api.fetch<IUserInfo>("api/users/", {
			method: "GET",
			headers: { "x-access-token": token },
		})
	}

	static async getInfo(user: User, id: IPerson["_id"]) {
		return Api.fetch<IUserInfo>(`api/users/${id}`, {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
	}

	static async setInfo(user: User, info: IUserInfo, attachment?: IAttachment) {
		return Api.fetch<IUserInfo>("api/users/", {
			method: "PUT",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				...info,
				photoAttachment: attachment ? attachment._id : "",
			}),
		})
	}

	static async search(user: User, params: UserSearchParams) {
		const query = `query=${params.query}&`
		const page = `page=${params.page}&`
		const fromRoom = params.fromRoom ? `fromRoom=${params.fromRoom}&` : ""
		const count = params.count ? `count=${params.count ? params.count : 20}` : ""

		const filter = Object.keys(params.filters).reduce(
			(acc, key) =>
				params.filters[key] !== undefined ? `${acc}${key}=${params.filters[key]}&` : acc,
			"",
		)

		const searchParams = query + page + fromRoom + filter + count

		return Api.fetch<SearchUserResult>(`api/users/search?${searchParams}`, {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
	}

	/** Дергает за сокет full_alert_state (получение уведомлений) */
	static getAlertState(user: User) {
		Api.fetch("api/users/v1/alert/state", {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
	}

	static async getSearchUsersValues(user: User): Promise<SearchUsersValues> {
		return Api.fetch("api/users/search/values", {
			method: "GET",
			headers: { "x-access-token": user.token },
		})
	}
}

type UserSearchParams = {
	query: string
	page: number
	filters: { [key: string]: string | undefined }
	fromRoom?: string
	count?: number
}

type SearchUserResult = {
	data: UserBySearch[]
	meta: {
		total: number
	}
	owners: string[]
}
