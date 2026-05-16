
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as readline from "readline";

const client = new Anthropic();

// Data persistence
const DATA_FILE = "habits_data.json";

interface Habit {
  id: string;
  name: string;
  category: string;
  frequency: string;
  startDate: string;
  completions: CompletionRecord[];
}

interface CompletionRecord {
  date: string;
  completed: boolean;
  notes?: string;
}

interface HabitsData {
  habits: Habit[];
}

// Load or initialize data
function loadData(): HabitsData {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data);
  }
  return { habits: [] };
}

// Save data
function saveData(data: HabitsData): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Create readline interface for user input
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Helper function to prompt user
async function prompt(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Calculate statistics for a habit
function calculateStats(habit: Habit): {
  totalDays: number;
  completedDays: number;
  streak: number;
  completionRate: number;
} {
  const completions = habit.completions;
  const totalDays = completions.length;
  const completedDays = completions.filter((c) => c.completed).length;
  const completionRate =
    totalDays > 0 ? ((completedDays / totalDays) * 100).toFixed(1) : 0;

  // Calculate current streak
  let streak = 0;
  for (let i = completions.length - 1; i >= 0; i--) {
    if (completions[i].completed) {
      streak++;
    } else {
      break;
    }
  }

  return {
    totalDays,
    completedDays,
    streak,
    completionRate: parseFloat(completionRate as string),
  };
}

// Format data for Claude
function formatHabitsForClaude(habits: Habit[]): string {
  if (habits.length === 0) {
    return "No habits tracked yet.";
  }

  let formatted = "Current Habits:\n";
  habits.forEach((habit, index) => {
    const stats = calculateStats(habit);
    formatted += `\n${index + 1}. ${habit.name} (${habit.category})\n`;
    formatted += `   - Frequency: ${habit.frequency}\n`;
    formatted += `   - Started: ${habit.startDate}\n`;
    formatted += `   - Completion Rate: ${stats.completionRate}% (${stats.completedDays}/${stats.totalDays} days)\n`;
    formatted += `   - Current Streak: ${stats.streak} days\n`;
    if (habit.completions.length > 0) {
      const lastWeek = habit.completions.slice(-7);
      const weekCompletion = lastWeek.filter((c) => c.completed).length;
      formatted += `   - Last Week: ${weekCompletion}/7 days completed\n`;
    }
  });

  return formatted;
}

// Main interaction loop with Claude
async function interactWithClaude(data: HabitsData): Promise<void> {
  const rl = createReadlineInterface();
  const conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  const systemPrompt = `You are a health and wellness coach helping users track and improve their healthy habits. 
You have access to their habit data and can provide personalized insights, motivation, and recommendations.
Your role is to:
1. Help users create and manage new habits
2. Analyze their progress and provide statistics
3. Give motivational feedback and suggestions
4. Help identify patterns and areas for improvement
5. Provide evidence-based tips for habit formation

When a user asks about their habits, reference the data provided.
Be encouraging and supportive while maintaining realistic expectations.`;

  console.log("\n🏃 Health Habits Tracker - Chat with AI Coach");
  console.log("============================================");
  console.log("Chat with your AI health coach about your habits.");
  console.log("Commands: 'add habit', 'log', 'stats', 'quit'");
  console.log("");

  let continueChat = true;

  while (continueChat) {
    const userInput = await prompt(rl, "You: ");

    if (userInput.toLowerCase() === "quit") {
      continueChat = false;
      break;
    }

    if (userInput.toLowerCase().startsWith("add habit")) {
      const habitName = await prompt(rl, "Habit name: ");
      const category = await prompt(
        rl,
        "Category (exercise/nutrition/sleep/mental/other): "
      );
      const frequency = await prompt(rl, "Frequency (daily/weekly): ");

      const newHabit: Habit = {
        id: generateId(),
        name: habitName,
        category,
        frequency,
        startDate: new Date().toISOString().split("T")[0],
        completions: [],
      };

      data.habits.push(newHabit);
      saveData(data);
      console.log(`✅ Habit "${habitName}" added!\n`);