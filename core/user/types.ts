import { IAttachment } from "../attachment"

export interface IPerson {
	_id: string
	type: "user" | "bot" | "channel"
	// name: string
	username: string
	firstName: string
	lastName: string
	achievements: Array<string>
	photo: Pick<IAttachment, "link" | "preview" | "_id">
	status: "online" | "offline"
	// owner: boolean
	agreedTerms: string[]
	timezone: number
	active: boolean
	moderator: boolean
}

export type IUserInfo = IPerson & {
	referrerUser: string
	subscribed: boolean
	phone: string
	companyNameBrief: string
	location: string
	employeePosition: string
	personalNumber: string
	email: string
	firstActiveDate: string
	lastActivity: string
	referralInput: boolean
	testAccess: boolean
	gbdat?: string
	dat02?: string
	ort01?: string
}

export type UserBySearch = Pick<
	IPerson,
	| "_id"
	| "username"
	| "achievements"
	| "firstName"
	| "lastName"
	| "photo"
	| "status"
	| "type"
	| "moderator"
	| "active"
> & {
	companyNameBrief?: string
	email: string | null
	employeeDepartment?: string
	employeePosition?: string
	lastActivity: string
}

export type SearchUsersValues = {
	companyCity: string[]
	employeeDepartment: string[]
	employeePosition: string[]
	location: string[]
	ort01: string[]
}

export interface IUser {
	token: string
	info?: IUserInfo | null
	sync(): Promise<void>
	logout(): void
	setInfo(info: IUserInfo): void
}
