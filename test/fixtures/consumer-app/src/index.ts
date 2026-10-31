import { fetchData, calculate, helper } from "sample-lib";

export async function run() {
  const result = await fetchData("https://api.example.com/items");
  const score = calculate(5, 10);
  helper();
  return { result, score };
}

