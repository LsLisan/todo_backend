import { Router } from "express";
import { requireAuth } from "../core/middleware/auth_middleware.js";
import {
    addSubTodoWorkItem,
    addTodoMember,
    addTodoWorkItem,
    createSubTodo,
    createTodo,
    deleteSubTodo,
    deleteSubTodoWorkItem,
    deleteTodo,
    deleteTodoWorkItem,
    getTodoById,
    listTodos,
    removeTodoMember,
    setSubTodoMembers,
    setSubTodoModerators,
    setTodoModerators,
    updateSubTodo,
    updateSubTodoWorkItem,
    updateTodo,
    updateTodoWorkItem,
} from "../features/user/todo/controller/todo_controller.js";

const router = Router();
router.use(requireAuth);

router.post("/", createTodo);
router.get("/", listTodos);
router.get("/:todoId", getTodoById);
router.patch("/:todoId", updateTodo);
router.delete("/:todoId", deleteTodo);

router.post("/:todoId/members", addTodoMember);
router.delete("/:todoId/members/:userId", removeTodoMember);
router.put("/:todoId/moderators", setTodoModerators);

router.post("/:todoId/work-items", addTodoWorkItem);
router.patch("/:todoId/work-items/:itemId", updateTodoWorkItem);
router.delete("/:todoId/work-items/:itemId", deleteTodoWorkItem);

router.post("/:todoId/subtodos", createSubTodo);
router.patch("/:todoId/subtodos/:subTodoId", updateSubTodo);
router.delete("/:todoId/subtodos/:subTodoId", deleteSubTodo);
router.put("/:todoId/subtodos/:subTodoId/members", setSubTodoMembers);
router.put("/:todoId/subtodos/:subTodoId/moderators", setSubTodoModerators);
router.post("/:todoId/subtodos/:subTodoId/work-items", addSubTodoWorkItem);
router.patch("/:todoId/subtodos/:subTodoId/work-items/:itemId", updateSubTodoWorkItem);
router.delete("/:todoId/subtodos/:subTodoId/work-items/:itemId", deleteSubTodoWorkItem);

export default router;