using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    public partial class MultiPostImages : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rename old single image column if exists then add new jsonb column.
            // Some providers don't support conditional logic; attempt safe pattern.
            try
            {
                migrationBuilder.RenameColumn(
                    name: "ImageObjectKey",
                    schema: "public",
                    table: "Posts",
                    newName: "_deprecated_single_image_key");
            }
            catch { /* ignore if column missing */ }

            migrationBuilder.AddColumn<string>(
                name: "image_object_keys",
                schema: "public",
                table: "Posts",
                type: "jsonb",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "image_object_keys",
                schema: "public",
                table: "Posts");

            migrationBuilder.RenameColumn(
                name: "_deprecated_single_image_key",
                schema: "public",
                table: "Posts",
                newName: "ImageObjectKey");
        }
    }
}
