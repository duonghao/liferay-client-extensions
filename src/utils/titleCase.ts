/** Turns an element id into a display name: `booking-record` -> `Booking Record` */
export const titleCase = (id: string) =>
	id
		.split(/[-_]+/)
		.filter(Boolean)
		.map(word => word[0].toUpperCase() + word.slice(1))
		.join(' ');
