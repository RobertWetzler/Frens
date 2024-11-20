using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Posts",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Posts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Posts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostUser",
                columns: table => new
                {
                    PostId = table.Column<string>(type: "text", nullable: false),
                    ViewersId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostUser", x => new { x.PostId, x.ViewersId });
                    table.ForeignKey(
                        name: "FK_PostUser_Posts_PostId",
                        column: x => x.PostId,
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostUser_Users_ViewersId",
                        column: x => x.ViewersId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "Email", "Name", "Password", "Username" },
                values: new object[,]
                {
                    { "user1", "john@example.com", "John Doe", "$2a$11$S.nyCZtkt89uQPm1.8t/hedPUrgh5GoQk3hsh3SMYikVg/DQKy79q", "johndoe" },
                    { "user2", "jane@example.com", "Jane Smith", "$2a$11$VUB4LfbHhr/aQhUpxbDEXe1X7yb/qDs0CK8jRcTv6/j.8SS00mHha", "janesmith" },
                    { "user3", "bob@example.com", "Bob Wilson", "$2a$11$BtLENedQGOkSALOZB4zMnObefixI/GmmrWWx6oLntoJdtIt/xNxr6", "bobwilson" }
                });

            migrationBuilder.InsertData(
                table: "Posts",
                columns: new[] { "Id", "Date", "Text", "UserId" },
                values: new object[,]
                {
                    { "post1", new DateTime(2024, 11, 14, 5, 43, 59, 776, DateTimeKind.Utc).AddTicks(5481), "Hello world! This is my first post.", "user1" },
                    { "post2", new DateTime(2024, 11, 14, 17, 43, 59, 776, DateTimeKind.Utc).AddTicks(5510), "Excited to join this platform!", "user2" },
                    { "post3", new DateTime(2024, 11, 14, 23, 43, 59, 776, DateTimeKind.Utc).AddTicks(5513), "Another day, another post. #coding", "user1" }
                });

            migrationBuilder.InsertData(
                table: "PostUser",
                columns: new[] { "PostId", "ViewersId" },
                values: new object[,]
                {
                    { "post1", "user2" },
                    { "post1", "user3" },
                    { "post2", "user1" },
                    { "post2", "user3" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Posts_UserId",
                table: "Posts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PostUser_ViewersId",
                table: "PostUser",
                column: "ViewersId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PostUser");

            migrationBuilder.DropTable(
                name: "Posts");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
