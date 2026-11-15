import { Router } from "express";
import { tarefaController } from "../controllers/index.js";
import {
  validate,
  createTarefaSchema,
  updateTarefaSchema,
  tarefaIdParamSchema,
} from "../middlewares/index.js";

const router = Router();

router.get("/", tarefaController.listarTarefas);
router.get(
  "/:objectId",
  validate(tarefaIdParamSchema),
  tarefaController.buscarTarefa
);
router.post("/", validate(createTarefaSchema), tarefaController.criarTarefa);
router.put(
  "/:objectId",
  validate(tarefaIdParamSchema),
  validate(updateTarefaSchema),
  tarefaController.atualizarTarefa
);
router.delete(
  "/:objectId",
  validate(tarefaIdParamSchema),
  tarefaController.removerTarefa
);

export default router;
