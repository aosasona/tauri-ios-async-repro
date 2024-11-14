import Database from "@tauri-apps/plugin-sql";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { warn, debug, trace, info, error } from '@tauri-apps/plugin-log';

function forwardConsole(
	fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
	logger: (message: string) => Promise<void>
) {
	const original = console[fnName];
	console[fnName] = (message) => {
		original(message);
		logger(message);
	};
}

forwardConsole('log', trace);
forwardConsole('debug', debug);
forwardConsole('info', info);
forwardConsole('warn', warn);
forwardConsole('error', error);

type Todo = {
	id?: number;
	title: string;
	completed: boolean;
	createdAt: number;
}

function App() {
	const [todos, setTodos] = useState<Todo[]>([]);

	useEffect(() => {
		Database.load("sqlite:todo.db")
			.then(async (_) => { console.log("Database loaded"); })
			.catch(console.error);
	}, []);

	async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
		try {
			event.preventDefault();
			event.stopPropagation();

			const data = new FormData(event.currentTarget);
			const title = data.get("title") as string;
			const result: Todo = await invoke("create_todo", {
				todo: { title, completed: false, }
			});
			setTodos([...todos, result]);
		} catch (error) {
			console.error(error);
			window.alert((error as any)?.message || "An error occurred");
		}
	}

	return (
		<main className="container px-3">
			<h2 className="text-2xl font-bold text-zinc-900">Todos</h2>
			<form className="px-2 py-3 rounded-md space-y-3" onSubmit={handleFormSubmit}>
				<input name="title" className="w-full border border-zinc-200 py-1 px-2 focus:outline-none focus:ring focus:ring-zinc-900" placeholder="Add a new todo" />
				<button type="submit" className="w-full text-sm bg-zinc-900 text-white py-2 px-2 rounded-md hover:scale-95 hover:border hover:border-neutral-800 transition-all">Add</button>
			</form>

			{todos.length === 0 ? (
				<div className="mt-3">
					<p className="text-sm text-center text-zinc-500">No todos yet.</p>
				</div>
			) : (
				<ul className="mt-3 border border-zinc-200 rounded-md">
					{todos.map(todo => (
						<li key={todo.id} className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-200 last:border-b-0">
							<label className="flex items-center space-x-2">
								<input type="checkbox" checked={todo.completed} />
								<span className={todo.completed ? "line-through" : ""}>{todo.title}</span>
							</label>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}

export default App;
