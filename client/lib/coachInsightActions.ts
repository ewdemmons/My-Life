import { Alert } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { buildLifeAreaContext } from "@/lib/lifeAreaCoachUtils";
import { coachCommandToAction, runCommandAction, CommandActionHelpers } from "@/lib/runCommandAction";
import { getLocalDateString } from "@/utils/planUtils";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { CoachInsightAction, LifeAreaProfile, LifeCategory } from "@/types";

export async function executeCoachInsightAction(
  action: CoachInsightAction,
  params: {
    category: LifeCategory;
    profile: LifeAreaProfile;
    navigation: NativeStackNavigationProp<RootStackParamList>;
    commandHelpers: CommandActionHelpers;
  },
): Promise<void> {
  const { category, profile, navigation, commandHelpers } = params;
  const lifeAreaContext = buildLifeAreaContext(category, profile);

  if (action.actionType === "navigate_chat") {
    navigation.navigate("AssistantChat", {
      lifeAreaContext,
      openPlanningSession: action.openPlanningSession,
      initialPrompt: action.initialPrompt,
    });
    return;
  }

  if (action.actionType === "navigate_plan_generator") {
    navigation.navigate("DailyPlanGenerator", {
      initialDate: action.initialDate ?? getLocalDateString(),
    });
    return;
  }

  if (action.actionType === "command" && action.command) {
    const command = { ...action.command };
    if (command.type === "createEntry" || command.type === "createHabit" || command.type === "scheduleEvent") {
      command.input = {
        ...command.input,
        categoryId: (command.input.categoryId as string | undefined) ?? category.id,
      };
    }

    const result = await runCommandAction(coachCommandToAction(command), {
      ...commandHelpers,
      applyCreateEntryDefaults: (input) => ({
        ...input,
        categoryId: input.categoryId ?? category.id,
      }),
    });

    const buttons: Array<{
      text: string;
      style?: "default" | "destructive" | "cancel";
      onPress?: () => void;
    }> = [];

    if (result.undo) {
      buttons.push({
        text: "Undo",
        style: "destructive",
        onPress: () => {
          void result.undo?.();
        },
      });
    }
    buttons.push({ text: "OK", style: "default" });

    Alert.alert(
      result.success ? "Done" : "Couldn't complete",
      result.success ? result.message : result.error ?? result.message,
      buttons,
    );
  }
}
