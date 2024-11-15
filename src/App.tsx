import * as log from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import Database from "@tauri-apps/plugin-sql";

type Todo = {
	id?: number;
	title: string;
	completed: boolean;
	createdAt: number;
}

type Mode = "all" | "active" | "completed";

type ModeToggleButtonProps = {
	currentMode: Mode;
	mode: Mode;
	onModeChange: (mode: "all" | "active" | "completed") => void;
}
function ModeToggleButton({ mode, currentMode, onModeChange }: ModeToggleButtonProps) {
	return (
		<button className={`text-xs px-3 py-2 transition-all ` + (mode == currentMode ? "bg-white text-neutral-900" : "")} onClick={() => onModeChange(mode)}>
			{mode == "all" ? "All" : mode == "active" ? "Active" : "Completed"}
		</button >
	)
}


function App() {
	const [viewMode, setViewMode] = useState<Mode>("all");
	const [input, setInput] = useState<string>(""); // forms do not clear on submit here in tauri for some reason I haven't bothereed to look into
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

			// Clear the input field and focus it again
			event.currentTarget.reset();
		} catch (error) {
			console.error(error);
		} finally {
			setInput("");
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
		<main className="container mx-auto px-4 mt-safe-top">
			<div className="min-h-safe-top w-screen fixed top-0 left-0 bg-neutral-900/80 backdrop-blur-lg">
			</div>
			<h2 className="text-2xl font-bold text-neutral-100 mt-2 md:mt-5 mb-4">Tasks</h2>
			<form className="space-y-3 mb-6" onSubmit={handleFormSubmit}>
				<input name="title" value={input} onChange={e => setInput(e.target.value)} className="w-full bg-neutral-800 text-white py-2 px-3 text-sm focus:outline-none focus:ring focus:ring-neutral-200 rounded-md" placeholder="Add a new todo" autoFocus />
				<button type="submit" className="w-full text-sm bg-neutral-100 text-neutral-900 py-2 px-2 rounded-md hover:scale-95 hover:border hover:border-neutral-800 transition-all">Add</button>
			</form>

			{todos.length === 0 ? (
				<div className="mt-3">
					<p className="text-sm text-center text-neutral-300">No todos yet.</p>
				</div>
			) : (
				<>
					<div className="flex w-full justify-end">
						<div className="flex items-center border border-neutral-800 rounded-md overflow-clip">
							<ModeToggleButton currentMode={viewMode} mode="all" onModeChange={setViewMode} />
							<ModeToggleButton currentMode={viewMode} mode="active" onModeChange={setViewMode} />
							<ModeToggleButton currentMode={viewMode} mode="completed" onModeChange={setViewMode} />
						</div>
					</div>
					<ul className="mt-3 border border-neutral-800 rounded-md">
						{todos.map(todo => (
							<>
								{(todo.completed && viewMode === "active") || (!todo.completed && viewMode === "completed") ? null :
									(
										<li key={todo.id} className="flex items-center justify-between px-2 py-2 border-b border-neutral-800 last:border-b-0">
											<label className="flex items-center space-x-2">
												<input type="checkbox" checked={todo.completed} onChange={() => toggleTodoStatus(todo.id as number)} />
												<span className={todo.completed ? "line-through opacity-60" : ""}>{todo.title}</span>
											</label>

											<button className="text-xs" onClick={() => deleteTodo(todo.id as number)}>
												❌
											</button>
										</li>
									)
								}
							</>
						))}
					</ul>
				</>
			)}
		</main>
	);
}

export default App;
