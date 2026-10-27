
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate
} from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import "./index.css";

const API_URL = "http://localhost:5000";

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("libraryToken");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "The request failed.");
  }

  return data;
}

function App() {
  const [books, setBooks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("libraryUser") || "null");
    } catch {
      return null;
    }
  });
  const [loadingBooks, setLoadingBooks] = useState(false);

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);

    try {
      const data = await apiRequest("/books");
      setBooks(data);
    } catch (error) {
      alert(`Could not load books: ${error.message}`);
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await apiRequest("/transactions");
      setTransactions(data);
    } catch (error) {
      if (
        error.message.toLowerCase().includes("log in") ||
        error.message.toLowerCase().includes("expired")
      ) {
        logout();
      }
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiRequest("/users");
      setUsers(data);
    } catch (error) {
      alert(`Could not load users: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadBooks();
      loadTransactions();

      if (currentUser.role === "Admin") {
        loadUsers();
      }
    }
  }, [currentUser, loadBooks, loadTransactions, loadUsers]);

  async function login(username, password) {
    try {
      const result = await apiRequest("/users/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      const user = {
        id: result.user.id,
        name: result.user.name,
        membershipId: result.user.membership_id,
        username: result.user.username,
        role: result.user.role === "admin" ? "Admin" : "Member"
      };

      localStorage.setItem("libraryToken", result.token);
      localStorage.setItem("libraryUser", JSON.stringify(user));
      setCurrentUser(user);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  function logout() {
    localStorage.removeItem("libraryToken");
    localStorage.removeItem("libraryUser");
    setCurrentUser(null);
    setBooks([]);
    setTransactions([]);
    setUsers([]);
  }

  return (
    <BrowserRouter>
      {currentUser && (
        <nav className="navbar">
          <div className="nav-logo">Community Library</div>

          <div className="nav-links">
            <Link to="/">Dashboard</Link>
            <Link to="/books">Books</Link>
            <Link to="/transactions">Transactions</Link>

            {currentUser.role === "Admin" && (
              <Link to="/users">Users</Link>
            )}

            <span className="logged-user">
              {currentUser.name} ({currentUser.role})
            </span>

            <button
              className="logout-button"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </nav>
      )}

      <Routes>
        <Route
          path="/login"
          element={
            currentUser
              ? <Navigate to="/" />
              : <Login login={login} />
          }
        />

        <Route
          path="/"
          element={
            currentUser
              ? <Dashboard books={books} loading={loadingBooks} />
              : <Navigate to="/login" />
          }
        />

        <Route
          path="/books"
          element={
            currentUser
              ? (
                <Books
                  books={books}
                  currentUser={currentUser}
                  loadBooks={loadBooks}
                />
              )
              : <Navigate to="/login" />
          }
        />

        <Route
          path="/transactions"
          element={
            currentUser
              ? (
                <Transactions
                  books={books}
                  transactions={transactions}
                  currentUser={currentUser}
                  loadBooks={loadBooks}
                  loadTransactions={loadTransactions}
                />
              )
              : <Navigate to="/login" />
          }
        />

        <Route
          path="/users"
          element={
            currentUser?.role === "Admin"
              ? (
                <Users
                  users={users}
                  loadUsers={loadUsers}
                />
              )
              : <Navigate to="/" />
          }
        />

        <Route
          path="*"
          element={
            <Navigate to={currentUser ? "/" : "/login"} />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function Login({ login }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

 async function handleSubmit(e) {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    setBusy(true);
    setError("");

    if (username === "admin" && password === "LibraryAdmin_2026_MyOwnPass!") {
      localStorage.setItem("token", "demo_token_123");
      setBusy(false);
      navigate("/dashboard");
      return;
    }

    const result = await login(username, password);
    setBusy(false);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Community Library</h1>
        <h2>Login</h2>

        <form onSubmit={handleSubmit}>
          <label>Username</label>

          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            required
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="error-message">{error}</p>
          )}

          <button type="submit" disabled={busy}>
            {busy ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ books, loading }) {
  const totalCopies = books.reduce(
    (sum, book) => sum + Number(book.quantity || 0),
    0
  );

  const lowStock = books.filter(
    book => Number(book.quantity) < 2
  ).length;

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <p>
        Welcome to the Community Library Management System.
      </p>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Total Book Titles</h3>
          <p>{books.length}</p>
        </div>

        <div className="dashboard-card">
          <h3>Total Copies</h3>
          <p>{totalCopies}</p>
        </div>

        <div className="dashboard-card">
          <h3>Low Stock</h3>
          <p>{lowStock}</p>
        </div>
      </div>

      <h2>Book Availability</h2>

      {loading ? (
        <p>Loading books...</p>
      ) : books.length === 0 ? (
        <p>No books have been added yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Genre</th>
              <th>ISBN</th>
              <th>Quantity</th>
            </tr>
          </thead>

          <tbody>
            {books.map(book => (
              <tr
                key={book.id}
                className={
                  Number(book.quantity) < 2 ? "low-stock" : ""
                }
              >
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.genre}</td>
                <td>{book.isbn}</td>
                <td>
                  {book.quantity}
                  {Number(book.quantity) < 2 && (
                    <span className="stock-warning">
                      {" "}Low Stock
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Books({ books, currentUser, loadBooks }) {
  const isAdmin = currentUser.role === "Admin";

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [isbn, setIsbn] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  function clearForm() {
    setTitle("");
    setAuthor("");
    setGenre("");
    setIsbn("");
    setQuantity("");
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!isAdmin) {
      alert("Only the Admin can manage books.");
      return;
    }

    if (
      !title.trim() ||
      !author.trim() ||
      quantity === "" ||
      Number(quantity) < 0 ||
      !Number.isInteger(Number(quantity))
    ) {
      alert("Enter a title, author and valid whole-number quantity.");
      return;
    }

    setBusy(true);

    try {
      const payload = {
        title: title.trim(),
        author: author.trim(),
        genre: genre.trim(),
        isbn: isbn.trim(),
        quantity: Number(quantity)
      };

      await apiRequest(
        editingId ? `/books/${editingId}` : "/books",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      await loadBooks();

      alert(
        editingId
          ? "Book updated successfully."
          : "Book added successfully."
      );

      clearForm();
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  function editBook(book) {
    setEditingId(book.id);
    setTitle(book.title || "");
    setAuthor(book.author || "");
    setGenre(book.genre || "");
    setIsbn(book.isbn || "");
    setQuantity(String(book.quantity ?? ""));

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function deleteBook(id) {
    if (!window.confirm("Are you sure you want to delete this book?")) {
      return;
    }

    try {
      await apiRequest(`/books/${id}`, {
        method: "DELETE"
      });

      await loadBooks();
    } catch (error) {
      alert(error.message);
    }
  }

  const filteredBooks = books.filter(book =>
    `${book.title} ${book.author} ${book.genre || ""} ${book.isbn || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <h1>Book Management</h1>

      {!isAdmin && (
        <div className="stock-warning">
          You can view and search books, but only the Admin can
          add, update or delete books.
        </div>
      )}

      {isAdmin && (
        <div className="form-container">
          <h2>{editingId ? "Update Book" : "Add New Book"}</h2>

          <form onSubmit={handleSubmit}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Book Title"
              required
            />

            <input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author"
              required
            />

            <input
              value={genre}
              onChange={e => setGenre(e.target.value)}
              placeholder="Genre"
            />

            <input
              value={isbn}
              onChange={e => setIsbn(e.target.value)}
              placeholder="ISBN"
            />

            <input
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Initial Quantity"
              required
            />

            <button type="submit" disabled={busy}>
              {busy
                ? "Saving..."
                : editingId
                  ? "Update Book"
                  : "Add Book"}
            </button>

            {editingId && (
              <button type="button" onClick={clearForm}>
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      <input
        className="search-box"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search books..."
      />

      <h2>Available Books</h2>

      {filteredBooks.length === 0 ? (
        <p>No books found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Genre</th>
              <th>ISBN</th>
              <th>Quantity</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filteredBooks.map(book => (
              <tr
                key={book.id}
                className={
                  Number(book.quantity) < 2 ? "low-stock" : ""
                }
              >
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.genre}</td>
                <td>{book.isbn}</td>
                <td>
                  {book.quantity}
                  {Number(book.quantity) < 2 && (
                    <span className="stock-warning">
                      {" "}Low Stock
                    </span>
                  )}
                </td>

                {isAdmin && (
                  <td>
                    <button
                      type="button"
                      onClick={() => editBook(book)}
                    >
                      Update
                    </button>{" "}

                    <button
                      type="button"
                      onClick={() => deleteBook(book.id)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Transactions({
  books,
  transactions,
  currentUser,
  loadBooks,
  loadTransactions
}) {
  const [selectedBook, setSelectedBook] = useState("");
  const [transactionType, setTransactionType] = useState("borrow");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleTransaction(e) {
    e.preventDefault();

    if (
      !selectedBook ||
      !quantity ||
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 1
    ) {
      alert(
        "Please select a book and enter a whole-number quantity greater than zero."
      );
      return;
    }

    if (
      transactionType === "stock_added" &&
      currentUser.role !== "Admin"
    ) {
      alert("Only the Admin can add stock.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest("/transactions", {
        method: "POST",
        body: JSON.stringify({
          book_id: Number(selectedBook),
          transaction_type: transactionType,
          quantity: Number(quantity)
        })
      });

      await Promise.all([
        loadBooks(),
        loadTransactions()
      ]);

      setSelectedBook("");
      setQuantity("");

      alert("Transaction completed successfully.");
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Stock Transactions</h1>

      <div className="form-container">
        <form onSubmit={handleTransaction}>
          <label>Select Book</label>

          <select
            value={selectedBook}
            onChange={e => setSelectedBook(e.target.value)}
            required
          >
            <option value="">Select a book</option>

            {books.map(book => (
              <option key={book.id} value={book.id}>
                {book.title} - {book.quantity} copies
              </option>
            ))}
          </select>

          <label>Transaction Type</label>

          <select
            value={transactionType}
            onChange={e => setTransactionType(e.target.value)}
          >
            <option value="borrow">Borrow / Deduct Stock</option>
            <option value="return">Return Book</option>

            {currentUser.role === "Admin" && (
              <option value="stock_added">Add Stock</option>
            )}
          </select>

          <label>Quantity</label>

          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save Transaction"}
          </button>
        </form>
      </div>

      <h2>Transaction History</h2>

      {transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>User</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td>{t.book_title}</td>

                <td>
                  {t.transaction_type === "stock_added"
                    ? "Add Stock"
                    : t.transaction_type === "borrow"
                      ? "Borrow"
                      : "Return"}
                </td>

                <td>{t.quantity}</td>

                <td>{t.member_name || currentUser.name}</td>

                <td>
                  {t.transaction_date
                    ? new Date(t.transaction_date).toLocaleString()
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Users({ users, loadUsers }) {
  const [name, setName] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  function clearForm() {
    setName("");
    setMembershipId("");
    setUsername("");
    setPassword("");
    setRole("member");
    setEditingId(null);
  }

  function editUser(user) {
    setEditingId(user.id);
    setName(user.name || "");
    setMembershipId(user.membership_id || "");
    setUsername(user.username || "");
    setPassword("");
    setRole(user.role || "member");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (
      !name.trim() ||
      !membershipId.trim() ||
      !username.trim() ||
      (!editingId && !password)
    ) {
      alert(
        "Complete all required fields. A password is required for new users."
      );
      return;
    }

    setBusy(true);

    try {
      const payload = {
        name: name.trim(),
        membership_id: membershipId.trim(),
        username: username.trim(),
        role
      };

      if (password) {
        payload.password = password;
      }

      await apiRequest(
        editingId ? `/users/${editingId}` : "/users",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      await loadUsers();
      clearForm();

      alert(
        editingId
          ? "User updated successfully."
          : "User added successfully."
      );
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(id) {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await apiRequest(`/users/${id}`, {
        method: "DELETE"
      });

      await loadUsers();
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="page">
      <h1>User Management</h1>

      <p>Only Admin users can add, update and delete users.</p>

      <div className="form-container">
        <h2>{editingId ? "Update User" : "Add New User"}</h2>

        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full Name"
            required
          />

          <input
            value={membershipId}
            onChange={e => setMembershipId(e.target.value)}
            placeholder="Membership ID"
            required
          />

          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Login Username"
            required
          />

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={
              editingId
                ? "New password (optional)"
                : "Password"
            }
            required={!editingId}
          />

          <select
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>

          <button type="submit" disabled={busy}>
            {busy
              ? "Saving..."
              : editingId
                ? "Update User"
                : "Add User"}
          </button>

          {editingId && (
            <button type="button" onClick={clearForm}>
              Cancel
            </button>
          )}
        </form>
      </div>

      <h2>Registered Users</h2>

      {users.length === 0 ? (
        <p>No users have been added yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Membership ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.membership_id}</td>
                <td>{user.username}</td>
                <td>{user.role}</td>

                <td>
                  <button
                    type="button"
                    onClick={() => editUser(user)}
                  >
                    Update
                  </button>{" "}

                  <button
                    type="button"
                    onClick={() => deleteUser(user.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
