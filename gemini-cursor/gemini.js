import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyABYXK2e7qY7Lo1PFGKern9_FnKGtWjaV8");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const result = await model.generateContent("Generate a JavaScript function to debounce a callback");
console.log(result.response.text());
