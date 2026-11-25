// Possibly deprecated unless recycled as another modal

"use client";

import { SubmitEvent, useState } from "react";

type LoginModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit?: (credentials: { username: string; password: string }) => void;
};

const buttonStyles = `
	font-semibold
	w-full px-4 py-2.5
	bg-transparent bg-linear-135
	from-[#f3f6f9] dark:from-[#274072]
	hover:from-[#99B3CC] dark:hover:from-[#416BBE]
    transition duration-200 ease-out
	hover:cursor-pointer
`;

export default function LoginModal({ isOpen, onClose, onSubmit }: LoginModalProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");

	if (!isOpen) return null;

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		onSubmit?.({ username, password });
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section className="relative w-full max-w-md bg-[#d5dee8] dark:bg-[#1b2a40] p-8">
				<button className="absolute right-4 top-3 p-1 text-2xl hover:cursor-pointer" onClick={onClose} type="button">
					×
				</button>

				<h2 className="mb-2 text-2xl font-bold" id="login-title">Sign In</h2>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="block text-sm font-medium" htmlFor="login-username">
						Username
						<input
							className="mt-1 block w-full border border-gray-300 px-3 py-2 font-normal outline-none"
							id="login-username"
							onChange={(event) => setUsername(event.target.value)}
							type="text"
							value={username}
						/>
					</label>

					<label className="block text-sm font-medium" htmlFor="login-password">
						Password
						<input
							className="mt-1 block w-full border border-gray-300 px-3 py-2 font-normal outline-none"
							id="login-password"
							onChange={(event) => setPassword(event.target.value)}
							type="password"
							value={password}
						/>
					</label>

					<hr />
					<button className={buttonStyles} type="submit">
						Sign in
					</button>
				</form>
			</section>
		</div>
	);
}
