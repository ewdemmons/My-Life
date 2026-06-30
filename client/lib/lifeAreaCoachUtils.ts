import { Alert } from "react-native";
import type { LifeAreaContext } from "@/navigation/RootStackNavigator";
import type { LifeAreaProfile, LifeCategory } from "@/types";

export function showRetakeAssessmentAlert(
  lifeAreaName: string,
  onContinue: () => void,
  onCancel?: () => void,
) {
  Alert.alert(
    `Retake ${lifeAreaName} Assessment?`,
    `Retaking this assessment will replace your current ${lifeAreaName} Profile, including any manual edits you've made. Continue?`,
    [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Continue", onPress: onContinue },
    ],
  );
}

export function buildLifeAreaContext(
  category: LifeCategory,
  profile?: LifeAreaProfile,
): LifeAreaContext {
  const base: LifeAreaContext = {
    categoryId: category.id,
    name: category.name,
    description: category.description || undefined,
  };

  if (profile?.status === "completed") {
    base.profile = {
      primaryGoal: profile.primaryGoal,
      currentFocus: profile.currentFocus,
      knownObstacles: profile.knownObstacles,
      currentState: profile.currentState,
      motivations: profile.motivations,
      successCriteria: profile.successCriteria,
    };
  }

  return base;
}
