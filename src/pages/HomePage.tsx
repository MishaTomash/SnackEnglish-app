import { Link } from "react-router-dom";

export const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <h1 className="text-2xl font-bold">Home Page</h1>
      <Link to="/" className="px-4 py-2 bg-gray-500 text-white rounded-lg">
        Назад
      </Link>
    </div>
  );
};
