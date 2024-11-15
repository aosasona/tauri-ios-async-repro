import * as log from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import Database from "@tauri-apps/plugin-sql";
import { Drawer } from 'vaul';

function MyComponent() {
	return (
		<Drawer.Root>
			<Drawer.Trigger>Open</Drawer.Trigger>
			<Drawer.Portal>
				<Drawer.Content>
					<Drawer.Title>Title</Drawer.Title>
				</Drawer.Content>
				<Drawer.Overlay />
			</Drawer.Portal>
		</Drawer.Root>
	);
}

type Todo = {
	id?: number;
	title: string;
	completed: boolean;
	createdAt: number;
}


function App() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [db, setDb] = useState<Database | null>(null);

	useEffect(() => {
		Database.load("sqlite:todos.db")
			.then((conn) => {
				conn.select("SELECT * FROM todos")
					.then((rows) => { setTodos(rows as Todo[]); })
					.catch(log.error)
					.finally(() => { setDb(conn); })
			})
			.catch(log.error)
	}, [])


	async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
		try {
			event.preventDefault();

			const data = new FormData(event.currentTarget);
			const title = data.get("title") as string;
			const result: Todo = await invoke("create_todo", { title, completed: false });
			setTodos([...todos, result]);
		} catch (error) {
			console.error(error);
			window.alert((error as any)?.message || "An error occurred");
		}
	}

	async function deleteTodo(id: number) {
		try {
			await invoke("delete_todo", { id });
			setTodos(todos.filter(todo => todo.id !== id));
		} catch (error) {
			console.error(error);
			window.alert((error as any)?.message || "An error occurred");
		}
	}

	async function toggleTodoStatus(id: number) {
		try {
			const todo = todos.find(todo => todo.id === id);
			if (!todo) return;

			const result: Todo = await invoke("toggle_completed", { id });
			setTodos(todos.map(todo => todo.id === id ? result : todo));
		} catch (error) {
			console.error(error);
			window.alert((error as any)?.message || "An error occurred");
		}
	}

	if (!db) {
		return (
			<main className="container mx-auto flex items-center justify-center h-screen">
				<p className="text-sm text-center text-neutral-300">Loading...</p>
			</main>
		);
	}

	return (
		<main className="container mx-auto px-3 mt-safe-top">
			<div className="min-h-safe-top w-screen fixed top-0 left-0 bg-neutral-900/80 backdrop-blur-lg">
			</div>
			<h2 className="text-2xl font-bold text-neutral-100 mb-4">Tasks</h2>
			<form className="space-y-3 mb-6" onSubmit={handleFormSubmit}>
				<input name="title" className="w-full bg-neutral-800 text-white py-2 px-3 text-sm focus:outline-none focus:ring focus:ring-neutral-200 rounded-md" placeholder="Add a new todo" autoFocus />
				<button type="submit" className="w-full text-sm bg-neutral-100 text-neutral-900 py-2 px-2 rounded-md hover:scale-95 hover:border hover:border-neutral-800 transition-all">Add</button>
			</form>

			{todos.length === 0 ? (
				<div className="mt-3">
					<p className="text-sm text-center text-neutral-300">No todos yet.</p>
				</div>
			) : (
				<ul className="mt-3 border border-neutral-800 rounded-md">
					{todos.map(todo => (
						<li key={todo.id} className="flex items-center justify-between px-2 py-1.5 border-b border-neutral-800 last:border-b-0">
							<label className="flex items-center space-x-2">
								<input type="checkbox" checked={todo.completed} onChange={() => toggleTodoStatus(todo.id as number)} />
								<span className={todo.completed ? "line-through opacity-60" : ""}>{todo.title}</span>
							</label>

							<button className="text-sm" onClick={() => deleteTodo(todo.id as number)}>
								❌
							</button>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}

export default App;
